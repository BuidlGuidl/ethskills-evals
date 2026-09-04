# Post-mortem: 38 liquidations at 12:41 UTC

## Short version

Your staleness check answers the question *"is the oracle alive?"*. Nobody ever
asked the question that actually mattered: *"was the borrower able to reach the
chain?"*.

The Arbitrum sequencer was down 09:14–12:40. Chainlink's price feed on Arbitrum
is itself an L2 contract updated by L2 transactions, so it went down with
everything else — it published nothing for 3.5 hours. At 12:40 the sequencer
came back, the feed's off-chain nodes immediately pushed the *current* price
(11% lower), and that update landed in the same first blocks as the keeper bots'
liquidation calls.

So at the moment `latestRoundData()` was read:

- `answer` was correct — it was the real market price.
- `updatedAt` was seconds old — genuinely fresh.
- `block.timestamp - updatedAt <= 3600` passed honestly.

The check was not bypassed, not fooled, not misconfigured. It did exactly its
job. Its job just isn't the one you needed.

## Why the check is structurally blind to this

The price didn't go stale. It went **discontinuous**. Your contract saw the
pre-crash price, then the post-crash price, with nothing in between and no
wall-clock gap on the reading side. From the contract's point of view an 11%
drop happened instantaneously between two fresh observations.

Two facts compound it:

1. **The clock you measure with stops when the chain stops.** `block.timestamp`
   only advances when blocks are produced. During the outage no code executed at
   all — the check wasn't merely passing, it was never evaluated. On restart both
   `block.timestamp` and `updatedAt` are current wall-clock. There is no arrangement
   of `block.timestamp - updatedAt` that can detect "the chain was unavailable for
   3.5 hours", because the measurement and the outage live in the same frozen
   clock. This is not a tuning problem. No threshold fixes it.

2. **Liquidation is a race your users were locked out of.** Solvency checks
   assume borrowers have a continuous opportunity to defend a position: price
   moves, you get a margin call window, you top up. The sequencer outage removed
   the borrowers' side of that assumption while leaving the keepers' side intact
   — keepers just queue and fire the instant the mempool drains. Your 38 users
   were not slow. They were fighting for the same first blocks against bots with
   better infrastructure, and by then they were already underwater at prices set
   3.5 hours earlier.

The formal fairness property a lending market needs is: **a position may only be
liquidated if its owner had a realistic opportunity to cure it after the price
that made it unhealthy became observable on-chain.** You never encoded that
property, so nothing enforced it.

(Arbitrum's L1 delayed inbox does let users force-include transactions during a
sequencer outage, but with a ~24h delay. It is a censorship-resistance escape
hatch, not a margin-call mechanism. It is not a defence here and you should not
count it as one.)

## Secondary finding: your 1-hour bound is a latent liveness bug

> "Our collateral feed's heartbeat is 86400 seconds, so our one-hour bound is far
> tighter than the feed itself promises."

Tighter than the heartbeat is not safer — it's a self-inflicted DoS. A Chainlink
feed updates on deviation *or* on heartbeat. If wstETH/USD trades quietly inside
the deviation threshold, that feed is contractually allowed to go up to 24 hours
without a new round. Every price read in your protocol then reverts with
`"stale price"` — no liquidations, no borrows, no withdrawals — for up to 23
hours, while the price is perfectly good. Under stress this is exactly backwards:
you freeze liquidations and accumulate bad debt.

The staleness bound must be **per-feed, ≥ heartbeat + a buffer** for that feed's
latency and update jitter (e.g. `86400 + 3600`). Hardcoding `3600` across feeds
with different heartbeats is a bug regardless of the outage.

It also, I suspect, contributed to the confusion here: a bound that looked
aggressively conservative created the impression that oracle risk was covered.

## What to change

Three layers. Layer 1 is mandatory and is the actual fix for this incident.

### Layer 1 — Chainlink L2 Sequencer Uptime Feed + grace period

Chainlink publishes an L2 Sequencer Uptime Feed on Arbitrum One (an
`AggregatorV3Interface`; verify the current address against Chainlink's L2
Sequencer Uptime Feeds docs before deploying — do not copy an address from a
blog post). `answer == 0` means up, `answer == 1` means down. Critically,
`startedAt` on the current round is **when the sequencer came back up**, which is
the anchor you need.

```solidity
error SequencerDown();
error SequencerGracePeriod();

AggregatorV3Interface public immutable sequencerUptimeFeed;
uint256 public constant GRACE_PERIOD = 30 minutes;

function _requireSequencerHealthy() internal view {
    (, int256 answer, uint256 startedAt, , ) = sequencerUptimeFeed.latestRoundData();

    // answer: 0 = up, 1 = down
    if (answer != 0) revert SequencerDown();

    // startedAt == 0 => round not yet initialised / feed not yet reporting.
    // Treat as down; do NOT let it fall through to the subtraction below.
    if (startedAt == 0) revert SequencerDown();

    if (block.timestamp - startedAt <= GRACE_PERIOD) revert SequencerGracePeriod();
}
```

Two details people get wrong:

- **Anchor on `startedAt`, not `updatedAt`.** `updatedAt` can be refreshed
  without the up-round having restarted; `startedAt` is the restart instant.
- **Guard `startedAt == 0`.** Skipping this gives you `block.timestamp - 0`,
  a huge number, which sails past the grace check — the guard silently
  no-ops in exactly the state it exists to catch.

`GRACE_PERIOD` should be long enough that a user watching the app can get a
top-up confirmed after service is restored, and short enough that you don't eat
unbounded bad debt while liquidations are paused. 30 minutes is a defensible
starting point for a 125% threshold on wstETH; make it a governance parameter and
tune it against your worst-case wstETH volatility. Be explicit that this is a
deliberate trade: you are accepting some bad-debt risk to buy your borrowers a
reaction window. That is the correct trade for a retail-facing market, but it
should be a decision on the record, not a side effect.

### Layer 2 — where it goes in the flow (the part that actually matters)

Do **not** put this at the top of every entrypoint. If you gate the whole
protocol during the grace period, borrowers still can't add collateral, and you
have reproduced the incident with extra steps and worse bad debt.

Put the guard inside the oracle read path, then route entrypoints by whether
they need a price at all:

```
PriceOracle.getPrice(asset)          <-- _requireSequencerHealthy() lives HERE
    |
    |-- liquidate()          needs price  -> reverts during grace   [DESIRED]
    |-- borrow()             needs price  -> reverts during grace   [DESIRED]
    |-- withdrawCollateral() needs price  -> reverts during grace   [DESIRED]
    |
    |-- depositCollateral()  NO price     -> works during grace     [CRITICAL]
    |-- repay()              NO price     -> works during grace     [CRITICAL]
```

The asymmetry is the whole design:

- **Risk-reducing actions (deposit collateral, repay debt) must never touch the
  oracle and must never be gated.** Adding collateral or repaying debt can only
  improve a position's health; no price is required to prove that. Audit these
  two paths and rip out any incidental `getPrice()` call (health-factor logging,
  a shared `_accrueAndCheck()` modifier, USD-denominated event fields, a
  `require(healthFactor > 1)` postcondition). Any one of those re-couples the
  path to the oracle and puts you straight back where you started.
- **Risk-increasing and adversarial actions (liquidate, borrow, withdraw) need a
  price, so they inherit the guard for free** by virtue of calling `getPrice()`.

Also expose an unguarded read for views, or your frontend goes dark during the
grace period — which is precisely when users need to see their health factor to
know how much to deposit:

```solidity
// view-only, never used in state-changing solvency math
function peekPrice(address asset) external view returns (uint256, bool sequencerOk);
```

And fix the staleness bound while you're in there:

```solidity
struct FeedConfig { AggregatorV3Interface aggregator; uint32 maxAge; uint8 decimals; }

function getPrice(address asset) public view returns (uint256) {
    _requireSequencerHealthy();

    FeedConfig memory cfg = feeds[asset];
    (, int256 answer, , uint256 updatedAt, ) = cfg.aggregator.latestRoundData();

    require(answer > 0, "bad price");
    require(updatedAt != 0, "incomplete round");
    require(block.timestamp - updatedAt <= cfg.maxAge, "stale price"); // heartbeat + buffer, per feed
    return _scale(uint256(answer), cfg.decimals);
}
```

### Layer 3 — blunt the post-grace cliff (recommended, not strictly required)

At `GRACE_PERIOD + 1` the same keeper sweep fires against whoever didn't cure in
time. Two cheap mitigations:

- **Cap the close factor immediately after the grace period.** Ramp from a small
  fraction (e.g. 10%) up to your normal close factor over the following ~30
  minutes. Users who were mid-transaction get partially liquidated instead of
  wiped, and keepers still have the incentive to clear genuinely toxic debt.
- **Liquidate-to-target instead of a flat close factor.** Seize only enough to
  restore the position to a modest buffer above 125%. This is good practice
  independent of sequencer risk, and it caps borrower loss in every fast-drop
  scenario, not just this one.

## Also worth checking while this is open

- **`minAnswer`/`maxAnswer` circuit breakers.** Some aggregators clamp the
  reported answer at configured bounds. If wstETH/USD ever pins to `minAnswer`,
  your feed reports a fresh, valid, wrong-by-a-lot price and every check above
  passes. This is the Venus/LUNA failure mode. At minimum, monitor for it.
- **Interest accrued during the outage.** Your 38 borrowers paid 3.5 hours of
  interest on positions they were locked out of. Small, but it belongs in the
  remediation discussion.
- **Every other `getPrice()` call site**, not just liquidation — anything that
  converts between assets, prices a fee, or values the reserve pool.
- **The 38 positions themselves.** Nothing above is retroactive. Whether you make
  those users whole is a governance and reputation call, but the finding to
  record in the post-mortem is unambiguous: those liquidations were *valid under
  the code as written* and *unfair under any reasonable reading of the product's
  promise*. That gap is the bug. The code was not broken; the specification was
  incomplete.

## The one-line takeaway for the post-mortem doc

A price freshness check proves the **oracle** was live. It says nothing about
whether the **user** was live. On an L2, those are two different liveness
domains, and a lending market that only checks the first one will liquidate
people for a market move they were physically prevented from responding to.
