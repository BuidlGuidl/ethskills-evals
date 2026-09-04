# Post-mortem: fresh price, no opportunity to react

## Root cause

This was not an oracle-staleness failure. It was an L2 sequencer-liveness failure combined with a missing post-recovery liquidation grace period.

The two clocks measured different properties:

- `block.timestamp - updatedAt <= 3600` asks whether the price observation is recent at the instant the liquidation executes.
- It does **not** ask whether borrowers had a functioning chain on which they could react to that price, nor whether enough usable time has elapsed since the sequencer recovered.

While Arbitrum was unavailable, borrowers' collateral-add transactions could not be ordered or executed. The external market continued moving and wstETH/ETH fell. Once service resumed, the oracle reported the current lower price. That made `updatedAt` only seconds old, so the existing check correctly accepted it. Keepers and the borrowers' queued transactions then competed for ordering in the first recovered blocks. Nothing in the protocol distinguished a normal fresh price from the first fresh price after a multi-hour period in which users could not transact. The keepers were ordered first and liquidated the positions.

The 86,400-second heartbeat is not relevant to this protection. A heartbeat is the maximum scheduled interval absent a deviation-triggered update; an 11% move can trigger a new report immediately. Making the staleness limit one hour only rejects old reports. It cannot create an opportunity to respond to a newly published, accurate report.

The failed invariant was therefore not “liquidations use a fresh price.” That invariant held. The missing invariant was:

> A position may be liquidated only after the L2 sequencer has been continuously available for a defined reaction period.

## Required change

Use Chainlink's Arbitrum sequencer uptime feed in addition to the collateral price feed. Its `answer` reports whether the sequencer is up (`0`) or down (`1`), and the round `startedAt` marks the start of the current status. Reject liquidation if the sequencer is down, and reject it until a grace period has elapsed after the current up round began.

Conceptually:

```solidity
uint256 public constant RECOVERY_GRACE_PERIOD = 1 hours; // governance-configurable in production

error SequencerDown();
error SequencerGracePeriod();
error InvalidSequencerRound();

function _requireLiquidationsAvailable() internal view {
    (
        uint80 roundId,
        int256 status,
        uint256 startedAt,
        uint256 updatedAt,
        uint80 answeredInRound
    ) = sequencerUptimeFeed.latestRoundData();

    if (
        startedAt == 0 ||
        updatedAt == 0 ||
        answeredInRound < roundId ||
        startedAt > block.timestamp
    ) revert InvalidSequencerRound();

    if (status != 0) revert SequencerDown();

    // Use subtraction in this order only after checking startedAt is not future-dated.
    if (block.timestamp - startedAt <= RECOVERY_GRACE_PERIOD) {
        revert SequencerGracePeriod();
    }
}

function liquidate(/* ... */) external {
    _requireLiquidationsAvailable(); // first substantive check
    uint256 price = _validatedCollateralPrice();
    // calculate health, update accounting, and transfer assets
}
```

Use the official sequencer uptime feed for the deployed network and verify its address and semantics at deployment; do not reuse an address from another chain. Fail closed if that feed reverts or returns malformed/unrecognised data.

### Exact placement in the flow

The sequencer/recovery gate belongs at the start of every liquidation entry point, before fetching or using a collateral price, calculating health, changing accounting, or transferring collateral. All batch-liquidation and alternate liquidation routes must pass through the same internal gate so it cannot be bypassed.

Apply the same availability gate to actions that increase protocol risk, such as new borrowing or collateral withdrawal. During the recovery grace period:

- permit collateral deposits and debt repayments;
- block liquidations;
- block borrowing and collateral withdrawals.

Risk-reducing functions should not unnecessarily call a price-validation wrapper that rejects during the grace period. If `addCollateral` or `repay` currently obtains a price even though it does not need one, split that flow so users can repair positions throughout recovery. If repayment accounting genuinely needs a price, provide a narrowly designed risk-reducing path rather than disabling the user's remedy with the same circuit breaker.

Keep the existing price checks as a separate second layer, and complete their round validation (`updatedAt != 0`, `startedAt != 0`, and, where applicable to the feed implementation, `answeredInRound >= roundId`). Configure staleness per the exact feed and its documented heartbeat/deviation behavior. Those checks address oracle validity; they do not replace the sequencer gate.

## Grace-period policy and operations

One hour is a common minimum, not a proof that one hour is sufficient for this market. Set `RECOVERY_GRACE_PERIOD` from the time borrowers reasonably need to notice recovery and get transactions included under expected congestion. Make it governed within sensible bounds and operationally pause liquidations if recovery is degraded. Alert on sequencer-down and sequencer-up transitions, display the liquidation-resumption timestamp in the app, and have keepers refuse liquidation until the same deadline.

The on-chain gate is authoritative; keeper policy and UI warnings are only defense in depth. With it, the first post-outage blocks accept repairs but cannot accept liquidations. Only after a continuous, usable recovery window can a fresh price make a position liquidatable.
