# Post-mortem: fresh price, unavailable market

## What happened

The freshness check answered the question it was designed to answer: **how recently was this price published?** It did not answer the different question that matters here: **have borrowers had a fair opportunity to transact since the chain became usable again?**

While the Arbitrum sequencer was unavailable, ordinary users could not execute their collateral deposits, but ETH price discovery continued elsewhere. No Solidity check could help users during that interval because their transactions were not being executed. When sequencing resumed, the oracle promptly published the current, 11%-lower price. Its `updatedAt` was therefore only seconds old, so the one-hour check correctly passed. The new price immediately made the positions liquidatable.

The outage erased the borrowers' reaction window. In the first recovery blocks, a keeper only had to win transaction ordering against deposits that had been stuck or had to be resubmitted. A tighter price timeout would not prevent this: once a post-recovery oracle update arrives, its age resets to zero. The feed's 86,400-second heartbeat is also immaterial to this incident; deviation-triggered updates can arrive earlier, and the observed round was genuinely current.

This is a missing **sequencer-liveness and post-recovery grace-period check**. Price validity and chain availability are independent safety conditions. Chainlink documents this precise L2 failure mode and provides an Arbitrum Sequencer Uptime Feed for it: `answer == 0` means up, `answer == 1` means down, and `startedAt` records the latest status transition. Its current documented Arbitrum One proxy is `0xFdB631F5EE196F0ed6FAa767959853A9F217697D`. See [Chainlink's L2 Sequencer Uptime Feed documentation](https://docs.chain.link/data-feeds/l2-sequencer-feeds).

## Required contract change

Integrate the Arbitrum Sequencer Uptime Feed and require both:

1. the sequencer is currently up; and
2. a configured grace period has elapsed since it came back up.

For example:

```solidity
AggregatorV3Interface public immutable sequencerUptimeFeed;

uint256 public constant SEQUENCER_GRACE_PERIOD = 1 hours;

error SequencerDown();
error SequencerFeedUninitialized();
error SequencerGracePeriodNotOver();

function _requireSequencerHealthy() internal view {
    (, int256 status, uint256 startedAt,,) =
        sequencerUptimeFeed.latestRoundData();

    // Arbitrum's feed can return startedAt == 0 before initialization.
    if (startedAt == 0) revert SequencerFeedUninitialized();
    if (status != 0) revert SequencerDown();

    // `startedAt` is when the current "up" status began.
    if (block.timestamp - startedAt <= SEQUENCER_GRACE_PERIOD) {
        revert SequencerGracePeriodNotOver();
    }
}

function _readRiskPrice() internal view returns (uint256) {
    // This must be before reading or acting on the asset price.
    _requireSequencerHealthy();

    (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt,
        uint80 answeredInRound) = feed.latestRoundData();

    require(answer > 0, "bad price");
    require(startedAt != 0 && updatedAt != 0, "invalid round");
    require(answeredInRound >= roundId, "incomplete round");
    require(updatedAt <= block.timestamp, "future price");
    require(block.timestamp - updatedAt <= PRICE_MAX_AGE, "stale price");

    return uint256(answer);
}
```

Use the verified uptime-feed proxy for the deployment network rather than blindly copying an address, and make the grace period an explicit risk parameter. One hour is the standard example and would have prevented this incident; the protocol should choose a period long enough for RPCs, the oracle, keepers, and users to recover and for defensive transactions to be included. Alerting and an emergency pause are useful additional controls, but neither substitutes for the on-chain guard.

## Where the guard belongs

Apply `_requireSequencerHealthy()` at the beginning of every state-changing path that consumes a price to worsen a user's risk or seize collateral, before the price read and before any effects or external calls. At minimum this includes:

- `liquidate` and batch-liquidation entry points;
- borrowing or minting more debt; and
- withdrawing collateral or any equivalent risk-increasing operation.

The liquidation path should therefore be ordered as:

```text
check sequencer is up
-> check post-recovery grace period has elapsed
-> read and validate the price round
-> calculate position health
-> perform liquidation
```

Do **not** put the recovery guard on risk-reducing operations. Adding collateral and repaying debt must remain callable as soon as transactions can execute, including during the grace period. If those functions currently call a shared health-checking price function, split the flow so they do not need an oracle read. Otherwise the proposed protection would also prevent borrowers from curing their positions during the window created for them.

Views may expose both the raw validated price and the sequencer status for monitoring, but no liquidation route may bypass the guarded risk-price path. Batch liquidations must perform the guard before processing the batch (or inherit it from a non-bypassable internal liquidation function).

## Why this fixes the incident

On recovery, the fresh market price may still show that the 38 accounts are below 125%. That fact is not ignored; its enforcement is delayed. During the grace period, keepers cannot liquidate, while borrowers can add wstETH or repay USDC. After the grace period, normal price validation and liquidation resume. The system then preserves both requirements: economically current pricing and a real opportunity for users to react after an L2 availability failure.
