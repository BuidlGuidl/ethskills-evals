# Post-mortem: fresh oracle data did not imply a fair liquidation opportunity

## Root cause

The freshness check answered the question it was designed to answer: **was this oracle observation published recently?** It did not answer the question the liquidation system also needed to answer: **has the borrower had a usable period in which to react to this price?**

During the Arbitrum sequencer outage, no L2 transactions were being ordered. Borrowers therefore could not add collateral or repay, and keepers could not liquidate. The external market nevertheless continued moving and wstETH fell.

When the sequencer resumed, the oracle published a current post-drop price. Its `updatedAt` was only seconds old, so the one-hour staleness check correctly passed. Keepers could then use that fresh price immediately. The borrowers' previously submitted transactions had no protocol-level priority over the oracle update or keeper transactions; some may not even have reached the sequencer and had to be resubmitted. Consequently, the first post-recovery ordering could be:

1. publish the current, lower price;
2. execute keeper liquidations;
3. only later execute borrowers' rescue transactions.

All 38 positions could therefore be validly liquidated according to the contract while their owners had enjoyed zero executable time between the price becoming available on L2 and liquidation. Tightening the price-age bound does not prevent this. In fact, a seconds-old catch-up price passes an even tighter bound.

The missing control was an **L2 sequencer-liveness check with a post-recovery grace period**. This is a high-severity design failure because it predictably permits unfair mass liquidations after an L2 outage and can concentrate liquidation execution into the first recovery blocks.

## Required change

Use Chainlink's Arbitrum Sequencer Uptime Feed in addition to the asset-price feed. Before any liquidation price is accepted:

```solidity
uint256 internal constant SEQUENCER_GRACE_PERIOD = 1 hours;

function _requireSequencerHealthy() internal view {
    (, int256 answer, uint256 startedAt,,) =
        sequencerUptimeFeed.latestRoundData();

    require(startedAt != 0, "sequencer feed uninitialized");
    require(answer == 0, "sequencer down"); // 0 = up, 1 = down
    require(
        block.timestamp >= startedAt + SEQUENCER_GRACE_PERIOD,
        "sequencer recovery grace period"
    );
}
```

`startedAt` is the time at which the current sequencer status began. Thus, after the feed changes back to `answer == 0`, liquidations remain disabled for the full grace period. Use the official Arbitrum One uptime-feed address for the deployment, make the configured address chain-specific, and validate it in deployment tests rather than copying an address from another network.

The one-hour value is the conventional minimum, not a proof that one hour is sufficient for this market. Governance should choose a period from an explicit risk analysis covering RPC recovery, oracle catch-up, wallet resubmission, keeper competition, and the time borrowers reasonably need to respond. Changing it should be timelocked and bounded; an emergency guardian may extend or pause liquidations, but should not be able to silently shorten the live grace period.

## Exact placement in the flow

Put the sequencer gate at the start of every external liquidation entry point, before reading/using the collateral price, before calculating health, and before any state mutation or token transfer:

```solidity
function liquidate(/* ... */) external nonReentrant {
    _requireSequencerHealthy();
    uint256 price = _validatedCollateralPrice();
    require(_collateralRatio(/* position, price */) < 1.25e18, "healthy");
    _executeLiquidation(/* ... */);
}
```

If liquidation can be reached through batch, callback, auction-start, or internal helper paths, enforce the same gate at a common internal boundary that none of those paths can bypass. A check only in the web app or keeper is insufficient.

Apply the same gate to operations that can increase protocol risk or exploit a discontinuous catch-up price: new borrowing, increasing debt, and withdrawing collateral. Depending on the protocol's settlement design, oracle-priced swaps or redemptions may need it too.

Do **not** gate protective operations on sequencer health once transactions can execute: adding collateral and repaying debt must remain available during the recovery grace period. Transfers and other operations that do not worsen solvency should remain available unless there is a separate reason to pause them.

The intended state machine is therefore:

| Sequencer state | Liquidate / borrow / withdraw collateral | Add collateral / repay |
|---|---:|---:|
| Down | impossible at chain level; contract also rejects if called through an available path | impossible at chain level |
| Up, grace period active | reject | allow |
| Up, grace period elapsed | allow, subject to fresh valid price and health checks | allow |

## Keep the price validation, but do not confuse it with liveness

Retain the positive-answer and per-feed staleness checks. Also validate the complete oracle round (`updatedAt != 0`, `startedAt != 0`, and, where applicable to the feed implementation, `answeredInRound >= roundId`) and use a staleness/deviation policy appropriate to the specific wstETH valuation path. A feed whose documented heartbeat is 24 hours may also be a poor fit for real-time liquidation even if a one-hour local maximum age causes it to revert rather than accept older observations.

Those oracle checks protect price integrity and age. The sequencer gate and recovery grace period protect the separate borrower-reaction invariant. Both are required. The tradeoff is deliberate: collateral prices can continue falling during the grace period, increasing bad-debt risk. That risk must be handled with conservative collateral factors, liquidation buffers, reserves/insurance, exposure caps, and an appropriately chosen grace period—not by allowing immediate post-outage liquidation before borrowers can transact.
