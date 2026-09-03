# Post-mortem: fresh price, no opportunity to react

The freshness check worked, but it checked the wrong kind of liveness for this incident.

`updatedAt` answers: **“How recently was this oracle answer published on this chain?”** It does not answer: **“Have borrowers been able to transact for a reasonable period since the chain recovered and this price became actionable?”**

From 09:14 through 12:40 the Arbitrum sequencer was unavailable. The borrowers' collateral-add transactions could not execute, but ETH continued repricing elsewhere. On recovery, the oracle promptly published the accumulated move. That new answer was accurate and only seconds old, so

```solidity
block.timestamp - updatedAt <= 3600
```

correctly evaluated to true. Keepers then got liquidations included before the borrowers' queued rescue transactions. The protocol atomically saw an up-to-date insolvent position, but its state contained no evidence that the borrower had been denied execution for the preceding 3.5 hours.

This was therefore not an oracle-staleness or arithmetic failure. It was a missing **L2 sequencer-recovery grace period**: freshness of market data was treated as if it implied a fair opportunity for users to act.

The feed heartbeat does not change that conclusion. A heartbeat is the longest expected interval absent a deviation-triggered update. An 11% move will normally trigger a new round, which is why the answer was fresh immediately after recovery. Conversely, imposing a one-hour max age on a feed whose documented heartbeat is 24 hours can unnecessarily halt the market in quiet conditions; it does not make a 24-hour feed provide a one-hour availability guarantee.

## Required change

Add Chainlink's Arbitrum One **Sequencer Uptime Feed** as an independent dependency. Configure and verify the official feed proxy for the deployment rather than conflating it with the wstETH price feed. The uptime feed uses `answer == 0` for up and `answer == 1` for down; its `startedAt` is the time of the latest status transition.

At the start of every liquidation execution path, before fetching a collateral price, calculating health, mutating state, or transferring assets, require all of the following:

1. the uptime round is initialized (`startedAt != 0`);
2. its time is sane (`startedAt <= block.timestamp`);
3. the sequencer is up (`answer == 0`); and
4. more than `SEQUENCER_GRACE_PERIOD` has elapsed since `startedAt`.

A minimal implementation is:

```solidity
uint256 public constant SEQUENCER_GRACE_PERIOD = 1 hours; // minimum policy

function _requireSequencerHealthy() internal view {
    (, int256 status, uint256 startedAt, , ) =
        sequencerUptimeFeed.latestRoundData();

    if (status != 0) revert SequencerDown();
    if (startedAt == 0 || startedAt > block.timestamp) {
        revert InvalidSequencerRound();
    }
    if (block.timestamp - startedAt <= SEQUENCER_GRACE_PERIOD) {
        revert SequencerRecoveryGracePeriod();
    }
}

function liquidate(/* ... */) external {
    _requireSequencerHealthy();               // availability/fair-reaction check
    uint256 price = _validatedWstEthPrice();  // independent price checks
    _accrueAndRequireLiquidatable(price);
    _executeLiquidation(/* ... */);
}
```

The exact execution order must be:

```text
sequencer is up
  -> recovery grace has elapsed
  -> price round is valid and fresh
  -> debt is accrued and health is recomputed
  -> liquidation executes
```

Centralize this in the internal liquidation primitive so direct, partial, full, batch, keeper-only, auction-start, self-liquidation, and other seizure routes cannot bypass it. A preview such as `isLiquidatable()` is not sufficient: execution must recheck the gate and health atomically.

Apply the same liveness gate to other **risk-increasing** actions—new borrowing, increasing debt, withdrawing collateral, and leverage—so nobody can exploit the recovery window. Do **not** put it in a generic oracle modifier that also guards rescue operations. During the recovery grace period, users must be able to add collateral and repay debt (including `repayFor`/permit variants) without requiring the sequencer or price gate. Those actions only improve protocol solvency.

One hour is the commonly used minimum, and it would have prevented the 12:41 sweep. The protocol should choose a documented window based on how long wallets, RPCs, the app, and users need to recover; a fixed longer window is safer if one hour is operationally insufficient. The boundary above deliberately keeps liquidation disabled while `elapsed <= grace`.

Finally, retain the price checks after the sequencer check, but configure max age per feed and validate the full round defensively: positive answer, nonzero and non-future `updatedAt`, and the chosen feed's actual update policy. If the market requires prices no older than one hour, use a feed that promises that service level or suspend price-dependent risk actions when it cannot be met; a 24-hour-heartbeat feed plus a 1-hour revert threshold is not such a guarantee.

The two controls protect different properties:

- price max age protects **data freshness**;
- sequencer status plus post-recovery grace protects **transaction availability and reaction time**.

The incident occurred because the first control was present and the second was absent.
