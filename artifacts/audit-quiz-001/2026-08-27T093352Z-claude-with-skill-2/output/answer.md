# Post-mortem: 38 liquidations after the Arbitrum sequencer outage

## 1. Short version

Your freshness check was never the thing that failed, and it could not have
caught this. It answers *"is this number recent?"*. The question liquidation
actually depends on is *"did the borrower have the ability to act on this
number?"* Those came apart for 3h26m because the Arbitrum sequencer was down.

Nothing in your contract knows the difference between "the chain is running and
this borrower chose not to top up" and "the borrower was locked out of the chain
entirely". You liquidated on the second, which is a punishment for inaction in a
window where action was impossible.

## 2. What actually happened, step by step

- **09:14 UTC** — Arbitrum One sequencer stops producing blocks. No L2 state
  transitions of any kind. That includes the Chainlink aggregator on Arbitrum:
  its price rounds are pushed *through the sequencer*, so the on-chain feed
  froze at the last pre-outage price too.
- **09:14 → 12:40** — ETH drops 11% on Binance and on mainnet. Your collateral
  (wstETH) is now worth materially less in reality. On Arbitrum, nothing has
  happened. Your users see their transactions accepted by the app and then sit
  there, because the sequencer never sequenced them. There is no L2 mempool they
  can outbid their way out of, and no gas price that helps.
- **12:41** — Sequencer restarts. The Chainlink node operators' queued price
  update lands in the first blocks, and because the deviation threshold was
  blown through hours ago it lands **immediately**, carrying the full 11% move
  in a single step.
- **12:41, same blocks** — Keeper bots have been sitting on the off-chain price
  the whole time. They know exactly which 38 positions cross 125% the moment
  that round lands, and their transactions are pre-signed and ready. They win
  the race into the first blocks trivially: the borrowers' rescue transactions
  from mid-morning were never accepted by the sequencer in the first place, so
  they are not ahead in any queue. Even the ones that were queued are competing
  in a restart ordering nobody can plan around.

The borrowers were given a price and a liquidation in the same block. The
reaction window was zero blocks wide.

## 3. Why your staleness check is structurally incapable of seeing this

```solidity
require(block.timestamp - updatedAt <= 3600, "stale price");
```

`updatedAt` is the timestamp of the round *as recorded on Arbitrum*. When the
sequencer is down, `block.timestamp` does not advance either — there are no
blocks. So during the outage the delta stays frozen and small. And after the
restart, the delta is genuinely tiny, because a real, correct, seconds-old price
did just land.

So the check passes at every point on the timeline, and it passes *honestly*.
The data was good. That is the trap: this is not an oracle-manipulation
incident and there is no bad price to find. Tightening 3600 → 300 → 60 does
nothing, because the number you are bounding was never large. Your feed's 86400
heartbeat is irrelevant here for the same reason.

A staleness check is a **data-quality** invariant. What you were missing is a
**chain-liveness** invariant. No amount of the first substitutes for the second.

There is a second-order version of the same mistake worth naming: on an L2, a
"fresh" price can be *fresh but discontinuous*. Post-restart the feed jumps in
one round by an amount that on L1 would have taken hundreds of blocks and given
everyone time to react. Your risk model implicitly assumes prices arrive as a
sequence users can respond to. Downtime breaks that assumption, not the feed.

## 4. The missing invariant

> A position may only be liquidated if the borrower has had a continuous,
> usable window on-chain, at or after the price that made them liquidatable, in
> which they could have cured the position.

Chainlink publishes exactly the primitive needed to enforce this: the **L2
Sequencer Uptime Feed**. On Arbitrum One:

`0xFdB631F5EE196F0ed6FAa767959853A9F217697D`

It is an `AggregatorV2V3Interface` where:
- `answer == 0` → sequencer **up**, `answer == 1` → **down**
- `startedAt` → timestamp at which the *current* status began

So `block.timestamp - startedAt` is exactly "how long has the chain been usable
again", which is the quantity your liquidation logic actually needs and has
never had.

## 5. The fix

### 5.1 The uptime gate

```solidity
interface IAggregatorV3 {
    function latestRoundData() external view returns (
        uint80 roundId, int256 answer, uint256 startedAt,
        uint256 updatedAt, uint80 answeredInRound
    );
}

contract SequencerGuard {
    IAggregatorV3 public immutable sequencerUptimeFeed;

    /// Time users must have had on a live chain before liquidations resume.
    uint256 public constant GRACE_PERIOD = 30 minutes;

    error SequencerDown();
    error SequencerGracePeriod(uint256 secondsRemaining);
    error UptimeFeedUninitialised();

    function _requireLiveAndSettled() internal view {
        (, int256 answer, uint256 startedAt, , ) =
            sequencerUptimeFeed.latestRoundData();

        // answer == 1 means the sequencer is currently down.
        if (answer != 0) revert SequencerDown();

        // Guard the documented edge case: startedAt == 0 means the feed itself
        // has not been initialised / is mid-restart. Treat as unusable, never
        // as "up since the epoch".
        if (startedAt == 0) revert UptimeFeedUninitialised();

        uint256 up = block.timestamp - startedAt;
        if (up < GRACE_PERIOD) revert SequencerGracePeriod(GRACE_PERIOD - up);
    }
}
```

### 5.2 Keep the price checks, and add the discontinuity guard

Your existing two `require`s stay — they are correct and still needed. Add one
more, which closes the "fresh but from before the outage" gap:

```solidity
function _price() internal view returns (uint256) {
    (, int256 answer, , uint256 updatedAt, ) = feed.latestRoundData();
    require(answer > 0, "bad price");
    require(block.timestamp - updatedAt <= MAX_PRICE_AGE, "stale price");
    return uint256(answer);
}
```

and in the liquidation path only, additionally require that the round you are
liquidating on was **published after the sequencer came back**:

```solidity
(, , uint256 seqStartedAt, , ) = sequencerUptimeFeed.latestRoundData();
(, , , uint256 updatedAt, ) = feed.latestRoundData();
require(updatedAt >= seqStartedAt, "price predates restart");
```

Without this you can hit the mirror-image bug: liquidating during the grace
window on a pre-outage price that the aggregator has not refreshed yet.

## 6. Where in the flow it goes — this is the part that matters most

Do **not** drop `_requireLiveAndSettled()` inside your shared `getPrice()`.

That is the obvious move and it is wrong, and it is wrong in precisely the way
that hurt your users. Every price-consuming path would then revert during the
grace period — including the paths borrowers need to save themselves. You would
spend 30 minutes telling people "the chain is back, and you still cannot add
collateral", which recreates the outage for the exact window you created to let
them escape it.

Gate by **direction of risk**, not by "does this function read a price":

| Path | Gate? | Why |
|---|---|---|
| `liquidate()` | **Yes** | The whole point. Punishes inaction; requires that action was possible. |
| `borrow()` | **Yes** | Increases risk against a price that just jumped discontinuously. |
| `withdrawCollateral()` | **Yes** | Same. |
| `depositCollateral()` | **No** | Reduces risk. Must be available the instant the chain is. |
| `repay()` | **No** | Reduces risk. Same. |
| `liquidate()` on a position already underwater pre-outage | see §7 | Judgement call. |

Concretely:

```solidity
function liquidate(address borrower, uint256 repayAmount) external {
    _requireLiveAndSettled();          // <-- FIRST LINE, before any price read
    ...
}

function borrow(uint256 amount) external {
    _requireLiveAndSettled();
    ...
}

function withdrawCollateral(uint256 amount) external {
    _requireLiveAndSettled();
    ...
}

function depositCollateral(uint256 amount) external {
    // deliberately NOT gated — this is the escape hatch
    ...
}

function repay(uint256 amount) external {
    // deliberately NOT gated
    ...
}
```

Note that `depositCollateral` and `repay` do not need a price at all if written
carefully — they strictly improve health, so they need no solvency check. If
yours currently calls `getPrice()` for a post-condition health assertion, remove
that assertion for health-improving actions. It buys nothing and it is a
liveness hazard.

Also: put the gate at the **entry point**, not deep in the pricing library. It
is a policy decision about *which user action is legitimate right now*, and it
belongs where that policy is legible, not buried where the next person to add a
function will forget it exists.

## 7. Parameter choice and the honest trade-off

The grace period is a straight transfer of risk from borrowers to the protocol.
For those 30 minutes, genuinely insolvent positions sit unliquidated while the
market can keep moving, and that is a bad-debt exposure you are choosing to take.

- **30 minutes** is the common choice and I'd start there. It is enough for a
  borrower with funds ready to bridge nothing and simply approve + deposit.
- **Do not go below ~15 minutes.** Below that you are back to a race the
  keepers win.
- **Do not go much above 60 minutes** unless you have modelled the bad-debt tail
  on an 11%-move scenario. Note the outage was 3h26m — your exposure is
  dominated by the outage itself, not by the grace period you add on top.

Two refinements worth considering, in order of value:

1. **Ramp the close factor during and just after the grace window.** Instead of
   binary allowed/not-allowed, permit only partial liquidation (e.g. close
   factor rising 0% → 50% over the grace period). Positions that are deeply
   underwater start getting cured before the cliff, while nobody gets wiped in a
   single block. This softens the "everything at once at T+30min" stampede that
   a hard gate creates.
2. **Suppress the liquidation bonus for the first N minutes after the gate
   lifts.** Keepers were paid a premium for a race that had no losers other than
   your users. Reduce the incentive to camp the restart boundary.

I would skip the "liquidate positions that were already unhealthy before the
outage" carve-out. It requires snapshotting per-position health, it is expensive,
and the pre-outage price is by definition the one your contract cannot trust.

## 8. Two things this does not fix, so you know the residual

- **Force inclusion is not a remedy for your users.** Arbitrum's delayed inbox
  lets a user bypass the sequencer via L1, but only after the ~24h force-inclusion
  delay. It is a censorship backstop, not an outage workaround. Do not let anyone
  in the write-up claim borrowers "could have used L1".
- **The gate protects against sequencer downtime specifically.** It does nothing
  for the case where the sequencer is up but the *Chainlink feed* stalls while
  the market moves. That is a separate invariant (feed heartbeat vs. deviation
  monitoring, and possibly a second feed for divergence checks). Worth a
  follow-up ticket; not in scope for this incident.

## 9. Restitution

Separate from the code, the 38 are a fairness question, not a technical one. The
on-chain record supports them: for each, you can show the liquidating transaction
landed within N blocks of `startedAt` on the uptime feed, with no intervening
block in which the borrower could have acted. That is a clean, objective,
auditable criterion for a make-whole, and it is the same predicate the new code
enforces going forward. Using it for both is worth something reputationally.

---

## Unresolved questions

1. Grace period value — 30 min, or do you want the bad-debt tail modelled on the
   actual 11% move first?
2. Hard gate or close-factor ramp? The ramp is better behaviour and more code.
3. Do `depositCollateral` / `repay` currently perform a price-dependent health
   assertion that would need removing?
4. Are there other price consumers (interest-rate model, LTV updates, a
   front-end quoter) that would break if `getPrice()` semantics change? This is
   why I kept the gate out of `getPrice()`.
5. Restitution scope: the 38, or anyone liquidated within the grace window on
   any past outage?
