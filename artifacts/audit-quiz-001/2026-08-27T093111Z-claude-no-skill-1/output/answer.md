# Post-mortem: 38 liquidations after the 2026-08-18 Arbitrum sequencer outage

## 1. Short version

Your freshness check was working. It just answers a different question than the one
liquidation actually depends on.

`block.timestamp - updatedAt <= 3600` asks: **"is this price recent, measured in chain
time?"**

Liquidation requires: **"did the borrower have a chance to respond to this price?"**

Those are the same question only when the chain is running. From 09:14 to 12:40 the
Arbitrum sequencer was not producing blocks. No blocks means no chain time advancing,
no oracle updates, and no user transactions — all three froze together. At 12:41 the
sequencer resumed; chain time jumped ~3.5h to real wall-clock time, and the Chainlink
aggregator was updated in those same first blocks with the current, correct, post-crash
price.

So at the moment your keeper's `latestRoundData()` executed:

- `updatedAt` ≈ now (published seconds earlier — true)
- `answer` = real market price after an 11% ETH drop (true)
- `block.timestamp - updatedAt` ≈ a few seconds (true)

Every assertion your code makes was correct. **The delta your check computes is between
two clocks that moved forward together.** It is structurally incapable of seeing the gap,
because the gap is not in the oracle — it is in the chain.

What you needed to know is the distance between *the last block a borrower could have
transacted in* and *now*. That number was 3h26m. Nothing in `latestRoundData()` contains
it.

## 2. Why this specific shape of failure

Liquidation is not a data operation, it is a **penalty for failing to act**. It is only
sound if action was possible. The design implicitly assumes continuous block production —
that a borrower watching their position can always get a top-up transaction in before the
LTV crosses. On an L2 with a single sequencer, that assumption is not free; it is an
availability dependency you inherited without declaring it.

During the outage, prices kept moving everywhere else (Binance, mainnet DEXes, -11%).
Your borrowers' *economic* health degraded continuously in the real world while their
*on-chain* health was frozen and unrepairable. When the chain unpaused, ~3.5 hours of
accumulated price movement was applied to every position in a single block, and 38
positions crossed 125% simultaneously. The "one sweep" pattern is the signature: real
liquidation flow is a trickle spread over blocks; a cliff of 38 at once is a resumption
artifact, not market activity.

Note also that Arbitrum's L1 force-inclusion path (delayed inbox) does exist, but its
delay window is on the order of ~24h. For a 3.5h outage it is not a usable escape hatch.
Your users' statement that they "could not get a transaction through" is literally
accurate.

### Why you can't detect this yourself

The obvious instinct is "compare this block's timestamp to the previous block's." The EVM
gives you no access to the previous block's timestamp. You could store `lastSeenTimestamp`
on every state-changing call and look at the jump, but that only works for a contract
touched in nearly every block, degrades silently when volume is low, and gives you no
signal at all about *partial* degradation. **The gap must come from an external signal.**
That signal exists and is canonical: the Chainlink L2 Sequencer Uptime Feed.

### A trap worth naming

Some teams tighten the staleness bound (86400 → 3600, exactly as you did) believing a
tight bound will catch a sequencer outage. It cannot, for the reason above — the price is
genuinely fresh the instant blocks resume. Tightening it further to 60s would not have
saved a single one of the 38 positions. Do not treat staleness as a liveness proxy.

## 3. What to change

### P0 — Sequencer uptime sentinel with a grace period

Add a second oracle read, whose subject is the chain rather than the asset.

```solidity
interface AggregatorV3Interface {
    function latestRoundData() external view returns (
        uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound
    );
}

/// Arbitrum One sequencer uptime feed: 0xFdB631F5EE196F0ed6FAa767959853A9F217697D
/// (confirm against Chainlink docs at deploy time — do not trust a hardcoded address in a post-mortem)
contract SequencerSentinel {
    AggregatorV3Interface public immutable uptimeFeed;
    uint256 public constant GRACE_PERIOD = 1 hours;

    constructor(AggregatorV3Interface feed) { uptimeFeed = feed; }

    /// true only if the sequencer is up AND has been up long enough for users to react
    function chainIsActionable() public view returns (bool) {
        (, int256 answer, uint256 startedAt, , ) = uptimeFeed.latestRoundData();
        if (answer != 0) return false;      // 1 == sequencer down
        if (startedAt == 0) return false;   // feed round not yet initialised — fail closed
        return block.timestamp - startedAt > GRACE_PERIOD;
    }
}
```

Semantics: `answer == 0` means up, `1` means down. `startedAt` is when the *current*
status began, so `block.timestamp - startedAt` is exactly the "how long have users been
able to transact" number your liquidation logic was missing.

Two details that bite people:
- `startedAt == 0` occurs in the feed's first round after deployment/upgrade. Treat as
  not-actionable (fail closed), do not let it underflow-or-pass.
- Still check `answer != 0` even though "the sequencer is down so no tx can run." A
  liquidation *can* arrive during downtime via L1 force-inclusion. Keep the down-check.

### P0 — Gate by action, at the entry point, not inside the price getter

This is the part that matters most for "where in the flow it goes."

**Do not put the sentinel check inside `getPrice()`.** If you do, you revert every path
that reads a price during the grace window — including, in most lending designs, `repay()`
and `depositCollateral()`. You would brick the exact rescue path your borrowers need, and
turn a 1-hour liquidation pause into a 1-hour total market freeze. This is the same class
of mistake as the original bug: a validity check placed where a policy check belongs.

Place it as the **first statement of each entry point**, before health computation:

| Function | Gate | Rationale |
|---|---|---|
| `liquidate()` | `require(sentinel.chainIsActionable(), "GracePeriod")` | Cannot punish inaction that was impossible |
| `borrow()` | same | Health-degrading; see below |
| `withdrawCollateral()` | same | Health-degrading; see below |
| `repay()` | **no gate** | Only improves health; must always be open |
| `depositCollateral()` | **no gate** | Only improves health; must always be open |

The borrow/withdraw gate is not optional. If you disable liquidations but leave
leverage-increasing actions open, you hand every user a free option for an hour: take on
maximum risk knowing no one can liquidate you if it goes wrong. Aave's `PriceOracleSentinel`
gates `isBorrowAllowed()` and `isLiquidationAllowed()` on the same condition for exactly
this reason — worth reading as prior art.

Concretely, in `liquidate()`:

```solidity
function liquidate(address user, uint256 repayAmount) external {
    require(sentinel.chainIsActionable(), "GracePeriod");   // <-- new, line 1
    uint256 price = _price();                                // unchanged
    require(_healthFactor(user, price) < 1e18, "healthy");   // unchanged
    ...
}
```

Ordering matters: the sentinel check is cheaper than the oracle read and is a
precondition of the whole operation, so it goes first.

### Choosing the grace period

1 hour is the sensible default. Shorter is close to worthless — when the sequencer
resumes there is a mempool and gas spike, and a borrower needs time to notice, unwind a
hedge, source USDC or wstETH, and land a transaction. 5 or 10 minutes does not buy that.

The cost is explicit and you should write it into the risk budget: during the grace
window the protocol carries unhedgeable market risk on positions it cannot close. A 3.5h
outage followed by 1h of no liquidations is 4.5h of unmanaged exposure.

If that is too much, the middle ground is a **two-tier threshold**: during the grace
period allow liquidation only of positions that are already *insolvent* (CR < 100%, where
delay strictly increases bad debt and the collateral no longer covers the debt), and
withhold liquidation of merely-undercollateralised positions (100% ≤ CR < 125%) until
grace expires. This protects the solvency floor without punishing the borrowers who could
still have saved themselves. It costs one extra threshold constant and a branch. I'd
recommend it if your risk committee balks at a flat 1h.

### P1 — Fix the staleness bound (separate latent bug)

`3600` against an `86400` heartbeat is not "conservative", it is a liveness hazard in the
other direction. A feed with an 86400s heartbeat and a deviation threshold will
legitimately go far longer than an hour without publishing when price is flat. Your check
will then revert on perfectly good data and halt the market — and if any of your
health-improving paths read the price, it halts those too.

Set the bound from the feed's actual parameters, per feed, with a buffer:

```solidity
require(updatedAt != 0, "incomplete round");
require(block.timestamp - updatedAt <= heartbeat + BUFFER, "stale price");  // e.g. 86400 + 3600
```

Store `heartbeat` per-feed in config rather than a global constant; you will add feeds
with different heartbeats and a single constant will be wrong for one of them.
(`answeredInRound` is deprecated — do not add it back.)

### P2 — Bound the damage of any resumption cliff

Even with the grace period, a resumption applies accumulated price movement in one block.
Two mitigations, both independent of the outage cause:

- **Close factor.** Cap a single liquidation at the amount needed to restore the position
  to just above the threshold plus a margin, rather than allowing a full close. A 126% →
  124% position should not lose everything.
- **Bonus ramp.** Start the liquidation incentive at ~0 when grace expires and ramp it to
  the full bonus over some minutes. Keepers still compete, but the first keeper in the
  first block does not capture the maximum penalty from every borrower at once.

### P3 — Operational

- Alert on the uptime feed transitioning to `1`, and on `startedAt` changing. You should
  learn about an outage from your own monitoring, not from user reports.
- Guardian pause on `liquidate()` as a manual backstop for degradation modes the uptime
  feed does not model (e.g. sequencer live but severely degraded, RPC provider outage
  affecting your frontend only).
- Your keepers are presumably permissionless. Do not attempt to fix this by asking keeper
  operators to hold off — the protocol must enforce it on-chain, or a third-party keeper
  will simply take the trade.

## 4. Ordering

1. Deploy `SequencerSentinel`, gate `liquidate` / `borrow` / `withdrawCollateral`. (P0)
2. Per-feed heartbeat-derived staleness bound. (P1)
3. Close factor + bonus ramp. (P2)
4. Monitoring and guardian. (P3)

Steps 1 and 2 are small and should ship together; they touch the same call sites.

## 5. On the 38

Separate from the code: those borrowers were penalised for failing to do something the
protocol made impossible. Whether to make them whole from treasury or rebate the
liquidation bonus is your call and not an engineering question, but the post-mortem will
read badly if it does not address it. It is also the cheapest available evidence that the
root cause was understood as a protocol defect rather than user error.

## Unresolved questions

1. Does your current `repay()` / `depositCollateral()` path read the price oracle? If yes,
   the gate placement above is load-bearing and needs a test asserting those paths stay
   open during grace.
2. Confirmed heartbeat and deviation threshold for your exact wstETH feed on Arbitrum One
   — the 86400 figure needs verifying against the live aggregator before it becomes a
   constant.
3. Flat 1h grace, or the two-tier CR < 100% carve-out? Depends on how much unhedged
   exposure risk will accept.
4. Is the wstETH price a direct feed, or composed from ETH/USD × an exchange rate? If
   composed, each component needs its own heartbeat bound and the sentinel logic is
   unchanged but the staleness fix is per-component.
5. Any other contracts in the system that make time-sensitive decisions (auctions,
   interest accrual caps, TWAP windows, governance timelocks)? They inherit the same
   assumption and should be audited against the same question: *does this punish inaction?*
