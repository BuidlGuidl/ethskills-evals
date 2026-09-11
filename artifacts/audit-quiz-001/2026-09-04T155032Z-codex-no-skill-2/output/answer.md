# Post-mortem: fresh price, unavailable market

The freshness check worked, but it checked the wrong failure mode.

`updatedAt` answers: **“How recently was this oracle answer published?”** It does not answer: **“Have borrowers had a fair opportunity to transact since the chain became usable?”** Oracle freshness and L2 transaction availability are independent properties.

While the Arbitrum sequencer was unavailable, borrowers could not get collateral-deposit transactions ordered into L2 blocks. The external ETH market nevertheless fell 11%. When sequencing resumed, the oracle transmitted the current lower price. That made the new round only seconds old, so the one-hour freshness check correctly passed. In that same recovery block race, keepers' liquidation transactions were ordered before the borrowers' rescue transactions. The contracts therefore saw both a fresh, correct price and undercollateralised accounts. Nothing in the existing logic represented the three-and-a-half-hour loss of user access or required a reaction period after access returned.

This was not a stale-oracle incident. It was an **L2 liveness/recovery-ordering incident**: a fresh post-outage price caused a discontinuous repricing before users were given an executable response window. A tighter price-age limit cannot fix that. In fact, because the collateral feed permits an 86,400-second heartbeat, an unconditional 3,600-second maximum age can also unnecessarily halt the market during a quiet period in which no deviation update occurs. Price validity must be configured against the feed's actual heartbeat/deviation policy; it is separate from the sequencer control.

## Required change

Integrate Chainlink's **Arbitrum Sequencer Uptime Feed** and add a post-recovery grace period. Check it before evaluating a position with the collateral price and before making any liquidation state change:

```solidity
AggregatorV3Interface public immutable sequencerUptimeFeed;

// Governance-set and publicly documented. One hour is a common starting
// value; choose a value long enough for users to observe recovery and obtain
// inclusion under expected congestion.
uint256 public constant SEQUENCER_GRACE_PERIOD = 1 hours;

error SequencerDown();
error SequencerGracePeriod();
error InvalidSequencerStatus();

function _requireSequencerHealthy() internal view {
    (, int256 status, uint256 startedAt,,) =
        sequencerUptimeFeed.latestRoundData();

    // For this feed: 0 = up, 1 = down. Unknown values fail closed.
    if (status == 1) revert SequencerDown();
    if (status != 0 || startedAt == 0 || startedAt > block.timestamp) {
        revert InvalidSequencerStatus();
    }

    // startedAt is the time of the latest status transition. When status is
    // up, this is when the sequencer most recently recovered.
    if (block.timestamp - startedAt <= SEQUENCER_GRACE_PERIOD) {
        revert SequencerGracePeriod();
    }
}

function liquidate(address borrower, /* ... */) external {
    _requireSequencerHealthy();       // first: outage/recovery eligibility
    uint256 price = _validatedPrice(); // second: answer and feed-age checks
    _liquidateIfUnsafe(borrower, price);
}
```

`_validatedPrice()` should continue to reject non-positive values and should explicitly reject an unset or future timestamp before subtracting:

```solidity
function _validatedPrice() internal view returns (uint256) {
    (, int256 answer,, uint256 updatedAt,) = feed.latestRoundData();
    if (answer <= 0) revert BadPrice();
    if (updatedAt == 0 || updatedAt > block.timestamp) revert BadPriceTime();
    if (block.timestamp - updatedAt > MAX_PRICE_AGE) revert StalePrice();
    return uint256(answer);
}
```

`MAX_PRICE_AGE` must be chosen consistently with the exact feed's documented heartbeat and deviation threshold (or the protocol must deliberately accept that a shorter bound can pause operations). It is not the sequencer grace period and must not be used as one.

## Where the gate applies

Apply the sequencer-health check at the common internal entry point used by **every liquidation path**—single, batch, delegated, callback, and any alternate collateral route—so it cannot be bypassed. The check must occur before health-factor evaluation and before transfers, debt burns, or collateral seizure. A batch must revert while the sequencer is down or within the grace period.

Use the same fail-closed gate for user actions that create or increase insolvency risk, such as borrowing more, withdrawing collateral, or enabling riskier leverage. Do **not** gate risk-reducing actions during the post-recovery grace period: collateral deposits, debt repayments, and voluntary position closure must remain available. That asymmetry is the purpose of the grace period—borrowers can repair positions while keepers cannot seize them. Normal pause/reentrancy/access controls still apply.

If the uptime-feed call fails, returns an unknown/uninitialised value, reports `down`, or has an impossible timestamp, liquidations and risk-increasing actions must fail closed. The protocol should alert on each of those states and on status transitions.

Finally, the grace period is measured from the uptime feed's `startedAt` for the transition back to `up`, not from the collateral price's `updatedAt`, not from the first application transaction, and not from a locally observed RPC recovery time. Tests should cover down status, the exact recovery boundary, batch liquidation, unavailable/malformed uptime data, a fresh price immediately after recovery, and successful deposits/repayments while liquidations remain blocked.

Had this gate existed, the price at 12:41 would still have been accepted as fresh and correct, but liquidation would have reverted until the recovery grace period expired. The 38 borrowers would have had that interval to get their already-attempted collateral additions or repayments included.
