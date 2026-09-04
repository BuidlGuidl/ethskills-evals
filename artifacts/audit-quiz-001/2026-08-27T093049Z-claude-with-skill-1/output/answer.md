# Post-mortem: 38 liquidations after the Arbitrum sequencer outage

## 1. Why the freshness check could never have caught this

Your check is:

```solidity
require(block.timestamp - updatedAt <= 3600, "stale price");
```

Both sides of that subtraction are **chain time**. `block.timestamp` only advances when
a block is produced. `updatedAt` is written by the Chainlink aggregator, which is itself
a contract on Arbitrum — its updates are also transactions that must be sequenced.

So during the outage:

- No blocks → `block.timestamp` frozen.
- No blocks → the aggregator cannot be updated → `updatedAt` frozen.
- The gap between them does not grow. It cannot grow. There is no block in which to
  evaluate it.

At 12:41 the sequencer resumes. In the same burst of blocks, the oracle nodes push the
backlog of price updates *and* the keepers land their liquidations. `block.timestamp` is
now real wall-clock time, `updatedAt` is seconds old, the delta is tiny, the price is
correct. Your check passes — correctly. It was never lying to you.

**A staleness check is structurally blind to sequencer downtime.** It measures the age of
the data relative to the chain. It cannot measure the age of the chain relative to the
world. Those are two different clocks, and the one that broke was the second one.

## 2. What actually went wrong

The failure is not an oracle failure. It is a **fairness/liveness** failure.

Liquidation is a punitive action justified by an implicit contract with the borrower:

> *"If your collateralisation falls below 125%, you will be liquidated — but you will
> have had the opportunity to see that price and respond to it."*

Your code enforces the first clause. Nothing in it enforces the second. For 3.5 hours the
market repriced ETH down 11% on Binance and mainnet while your borrowers were physically
unable to submit a transaction. The chain then applied that entire 3.5 hours of price
discovery **in a single step**, and the first actors to get a transaction into the
resumed chain were bots with hot retry loops, not humans with a wallet UI.

The 38 borrowers were liquidated on a price that was:

- fresh, by your definition;
- accurate, by any definition;
- and **unreachable**, which is the definition that mattered.

Three aggravating factors worth naming explicitly in the report:

**a) Force-inclusion was not an escape hatch.** Arbitrum's delayed inbox lets a user
bypass the sequencer by submitting through L1 — but only after the force-inclusion delay
(~24 hours / 5760 L1 blocks). Your outage was 3.5 hours. Nobody could have self-included
in time. Do not let anyone in the review claim users "could have gone through L1."

**b) The keepers won the restart by construction.** When the sequencer is offline the RPC
does not queue user transactions in any fair order — the app's submissions simply failed
or hung client-side. On resume, inclusion order is essentially "who reconnects and
retries fastest." That is a bot, every time. Your borrowers were never in the race.

**c) Interest kept accruing.** `block.timestamp` on Arbitrum tracks L1 time within bounds,
so on resume your accrual maths charged the full 3.5 hours of interest on debt the
borrowers were not permitted to service. That pushed marginal positions further under.

## 3. The fix

Four changes. The first two are the actual fix; the third and fourth are the ones that
stop this class of bug rather than this instance of it.

### Fix 1 — Consume the Chainlink L2 Sequencer Uptime Feed, and gate liquidations on a grace period

This is the on-chain signal that answers "has the chain been usable recently?" It is an
L1→L2 message, so it is populated correctly across an outage. On Arbitrum One the feed is
`0xFdB631F5EE196F0ed6FAa767959853A9F217697D` (verify against Chainlink docs before you
deploy — do not copy an address out of a post-mortem).

```solidity
// answer: 0 == sequencer up, 1 == sequencer down
// startedAt: timestamp at which the CURRENT status began
//            i.e. after a restart, this is the moment service was restored
AggregatorV3Interface public immutable sequencerUptimeFeed;
uint256 public constant GRACE_PERIOD = 3600; // see sizing note below

error SequencerDown();
error SequencerFeedUninitialised();
error GracePeriodNotOver();

function _requireSequencerLive() internal view {
    (, int256 answer, uint256 startedAt, , ) = sequencerUptimeFeed.latestRoundData();
    if (answer != 0) revert SequencerDown();
    // startedAt == 0 means the uptime feed itself is not yet initialised.
    // Treat as "unknown", i.e. unsafe — do NOT read this as "up since epoch".
    if (startedAt == 0) revert SequencerFeedUninitialised();
    if (block.timestamp - startedAt <= GRACE_PERIOD) revert GracePeriodNotOver();
}
```

Two gotchas that bite people implementing this:

- **Do not apply a heartbeat/staleness check to the uptime feed.** It only updates on a
  status *change*, so `updatedAt` is legitimately days or weeks old. A staleness check
  here bricks the protocol.
- **`startedAt == 0` must revert, not pass.** The uninitialised case otherwise reads as
  "up since 1970", which sails through the grace-period arithmetic.

### Fix 2 — Make health-improving actions oracle-independent

This is the more important half and the one usually missed.

If `_requireSequencerLive()` reverts everything, you have reimplemented the outage: your
borrowers still cannot add collateral, and now they cannot repay either. The grace period
only helps if there is something the borrower can *do* with it.

Adding collateral and repaying debt cannot make a position less healthy. They therefore
do not need a price at all. Remove the oracle read from those paths entirely:

| Action | Effect on health | Needs price? | Sequencer-up? | Grace period? |
|---|---|---|---|---|
| `depositCollateral` | improves | **no** | no | no |
| `repay` | improves | **no** | no | no |
| `borrow` | worsens | yes | yes | yes |
| `withdrawCollateral` | worsens | yes | yes | yes |
| `liquidate` | punitive | yes | yes | **yes** |

Grep the repo for `latestRoundData` and for every internal health-check helper. Any call
to them on the deposit or repay path is a bug independent of this incident — it means an
oracle problem of *any* kind (stale feed, feed deprecation, reverting aggregator) traps
borrowers in positions they are trying to de-risk.

### Fix 3 — Fix the staleness bound; it is backwards

```solidity
require(block.timestamp - updatedAt <= 3600, "stale price"); // feed heartbeat is 86400
```

A bound *tighter* than the feed's heartbeat is not extra safety. The feed is contractually
allowed to go 86,400 seconds without an update if the deviation threshold is not crossed.
Your code halts the protocol for up to 23 of those hours, in-spec, no incident required.
That halt is a latent second outage with the same victims.

Set the bound per-feed to `heartbeat + buffer` (e.g. `86400 + 3600`), and — because of
Fix 2 — make sure a stale-price revert can never block a repayment.

If you price wstETH as `wstETH/ETH × ETH/USD`, note the two feeds have independent
heartbeats and deviation thresholds. Apply the correct bound to each; do not use one
constant for both.

### Fix 4 — Self-armed grace, for the failures the uptime feed does not report

The Chainlink uptime feed reports "the sequencer is down." It does **not** report "the
sequencer is up but the chain is unusable" — congestion, a fee spike, RPC-layer failures,
or soft censorship. Same outcome for your borrowers, no signal.

Cheap belt-and-braces: have the market record the timestamp of the last state-changing
interaction, and arm the same grace period when it sees an implausible gap.

```solidity
uint256 public lastActivityAt;

function _touch() internal {
    uint256 gap = block.timestamp - lastActivityAt;
    if (gap > LIVENESS_GAP) graceUntil = block.timestamp + GRACE_PERIOD;
    lastActivityAt = block.timestamp;
}
```

Call `_touch()` on every entry point; have the liquidation gate honour
`max(uptimeFeedGrace, graceUntil)`. Tune `LIVENESS_GAP` above your quietest normal period
so it does not false-positive on a low-traffic weekend.

### Fix 5 (optional, and I would take it) — Ramp the close factor out of the grace period

At 12:41 you did not just liquidate; you liquidated 38 positions *at once, at full size,
at full penalty*, in the first blocks. Even with a correct grace period, the block after
grace expires is still a stampede.

```solidity
function _closeFactorBps() internal view returns (uint256) {
    uint256 sinceLive = block.timestamp - _sequencerLiveSince();
    if (sinceLive <= GRACE_PERIOD)          return 0;     // no liquidations
    if (sinceLive <= GRACE_PERIOD + RAMP)   return 2500;  // max 25% of debt repayable
    return 5000;                                          // normal close factor
}
```

Optionally ramp the liquidation bonus from a floor (~2%) to its full value over the same
window, so the earliest post-outage liquidators do not extract the maximum penalty from
borrowers who are three blocks away from topping up.

## 4. Where each check goes in the flow

Order matters. The sequencer check must come **before** the price read, not after — a
price that passes a staleness check is meaningless if the chain was dark, and you want
the revert reason to say `GracePeriodNotOver`, not `bad price`.

```
liquidate(user, repayAmount)
  │
  ├─ 1. _touch()                    ← liveness bookkeeping (Fix 4)
  ├─ 2. _requireSequencerLive()     ← uptime feed + grace period (Fix 1)
  │        reverts: SequencerDown / SequencerFeedUninitialised / GracePeriodNotOver
  ├─ 3. accrueInterest()
  ├─ 4. price = oracle.getPrice(wstETH)   ← THE ONLY place latestRoundData is called
  │        answer > 0, updatedAt != 0, age <= heartbeat + buffer   (Fix 3)
  ├─ 5. require(healthFactor(user) < 1e18)
  ├─ 6. repayAmount <= debt * _closeFactorBps() / 1e4              (Fix 5)
  └─ 7. seize collateral at ramped bonus

depositCollateral(amount) / repay(amount)
  ├─ 1. _touch()
  ├─ 2. accrueInterest()
  └─ 3. transfer + book it.   NO sequencer check. NO oracle read. NO health check.

borrow(amount) / withdrawCollateral(amount)
  ├─ 1. _touch()
  ├─ 2. _requireSequencerLive()
  ├─ 3. accrueInterest()
  ├─ 4. price = oracle.getPrice(wstETH)
  └─ 5. require(healthFactor(user) >= 1e18) post-action
```

Structurally: put the price read behind a single `PriceOracle` adapter contract and make
it the only thing in the codebase that touches `latestRoundData`. Right now the check is
inlined at the call site, which is why it is easy for one path to drift out of policy.
`grep -rn latestRoundData src/` should return exactly one hit after this change.

## 5. Sizing the grace period — the trade-off you are actually making

A grace period is a deliberate decision to **accept bad-debt risk in exchange for borrower
fairness**. During it, genuinely insolvent positions cannot be closed.

You can afford it here because your liquidation threshold is 125%: there is a 25%
buffer between "liquidatable" and "bad debt." An 11% move consumed less than half of it.
Size the grace period so that a plausible adverse move over `GRACE_PERIOD` seconds stays
inside that buffer, then subtract the move that may already have happened during the
outage itself. 3600s is the conventional value and is defensible at a 125% threshold; it
would **not** be defensible on a 105%-threshold stable-stable market, where you would want
minutes, not an hour.

Two accepted trade-offs to write down rather than discover later:

- Positions that were *already* liquidatable before 09:14 also get the extra hour. You
  could avoid this by checkpointing pre-outage health, but the complexity is not worth the
  marginal loss — take the simple version.
- Consider widening the liquidation threshold (or narrowing max LTV) slightly to fund the
  grace period out of the buffer rather than out of the protocol's solvency margin.

## 6. What does not fix this

- **A second oracle / a pull-based feed (Pyth, Redstone).** A pull oracle's update is also
  a transaction that needs the sequencer. If the chain is dark, you cannot push the price
  either. Multi-oracle setups solve oracle failure, not chain failure.
- **A guardian pause.** A guardian who needs to send a transaction during a sequencer
  outage cannot send a transaction during a sequencer outage. **Any mitigation that
  requires you to transact during the incident is not a mitigation.** This has to be
  on-chain and self-arming — which is exactly what Fixes 1 and 4 are.
- **Tightening the staleness bound further.** See section 1: the quantity being bounded
  cannot grow during the failure. Tightening it only increases the chance of the
  self-inflicted halt in Fix 3.
- **A raw price-deviation circuit breaker on its own.** Blocking an 11% move sounds
  appealing, but an 11% move can be entirely real and you will eventually have to honour
  it — you would just be deferring the same liquidations to a later block with a worse
  price. It is reasonable as *defence in depth* (flag → shorten nothing, but alert and
  optionally extend grace), not as the primary control.

## 7. Before you ship

Fork-test at the block boundary of the actual incident. The regression test to write:

1. Fork Arbitrum One at a block before 09:14.
2. Open a position at ~130% collateralisation.
3. Warp `block.timestamp` forward 3.5 hours with no intervening interaction, and set the
   uptime feed's `startedAt` to the resume timestamp.
4. Push the post-outage wstETH price.
5. Assert `liquidate` reverts with `GracePeriodNotOver`.
6. Assert `depositCollateral` and `repay` **succeed** in that same state — this is the
   assertion that proves Fix 2 landed, and it is the one that would have saved the 38.
7. Warp past `GRACE_PERIOD`, assert liquidation succeeds and is capped at 25% close factor.

Also add a unit test for `startedAt == 0` reverting, and one for the uptime feed being
weeks stale but reporting `answer == 0` still passing.

## 8. On the 38

Separate from the code: the liquidations were valid under the rules as written, but the
rules as written contained a defect that only harms borrowers, and the borrowers had
documented, on-chain-verifiable evidence of attempting to act. Reimbursing the liquidation
penalty (not the market loss — the 11% was real and would have been theirs regardless) is
the proportionate remedy, and it is a number you can compute exactly from the 38 seizures.
That is a governance call, not an engineering one, but the post-mortem should put the
option in front of whoever makes it.
