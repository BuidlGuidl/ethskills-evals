// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {IAggregatorV3} from "./interfaces/IAggregatorV3.sol";
import {IPriceOracle} from "./interfaces/IPriceOracle.sol";

/// @title ChainlinkOracle
/// @notice Adapter that turns Chainlink USD feeds into 1e18-scaled USD prices, with the safety
///         checks a lending market needs: positive answer, fresh round, complete round, and a
///         configured sanity band that a mispriced or hijacked feed cannot escape.
/// @dev Every read path reverts rather than returning a degraded price. A lending market that keeps
///      operating on a bad price is strictly worse than one that is temporarily frozen: a stale-high
///      price mints unbacked debt and a stale-low price hands honest borrowers to liquidators.
contract ChainlinkOracle is IPriceOracle, Ownable2Step {
    struct FeedConfig {
        IAggregatorV3 feed;
        /// @dev Max age of the feed's latest answer. Set from the feed's published heartbeat plus slack.
        uint32 heartbeat;
        /// @dev 10 ** feed.decimals(), cached at configuration time.
        uint64 scale;
        /// @dev Inclusive sanity band in feed-native decimals. An answer outside it is treated as broken.
        uint128 minAnswer;
        uint128 maxAnswer;
    }

    mapping(address asset => FeedConfig) private _feeds;

    event FeedSet(address indexed asset, address indexed feed, uint32 heartbeat, uint128 minAnswer, uint128 maxAnswer);

    error FeedNotConfigured(address asset);
    error InvalidFeedConfig();
    error BadPrice(address asset);
    error StalePrice(address asset, uint256 updatedAt);

    constructor(address initialOwner) Ownable(initialOwner) {}

    /// @notice Configure (or replace) the feed backing `asset`.
    /// @param heartbeat Maximum tolerated age of an answer, in seconds.
    /// @param minAnswer Lower sanity bound, in the feed's own decimals (exclusive-of-zero, inclusive bound).
    /// @param maxAnswer Upper sanity bound, in the feed's own decimals.
    function setFeed(address asset, IAggregatorV3 feed, uint32 heartbeat, uint128 minAnswer, uint128 maxAnswer)
        external
        onlyOwner
    {
        if (asset == address(0) || address(feed) == address(0)) revert InvalidFeedConfig();
        if (heartbeat == 0 || minAnswer == 0 || maxAnswer < minAnswer) revert InvalidFeedConfig();

        uint8 feedDecimals = feed.decimals();
        // Prices are normalised by multiplying up to 1e18; feeds with more than 18 decimals are rejected
        // rather than silently truncated.
        if (feedDecimals > 18) revert InvalidFeedConfig();

        _feeds[asset] = FeedConfig({
            feed: feed,
            heartbeat: heartbeat,
            scale: uint64(10 ** feedDecimals),
            minAnswer: minAnswer,
            maxAnswer: maxAnswer
        });

        // Fail the configuration transaction if the feed is not currently usable, so a typo'd address
        // or a dead feed is caught at deploy time rather than at the first borrow.
        getAssetPrice(asset);

        emit FeedSet(asset, address(feed), heartbeat, minAnswer, maxAnswer);
    }

    /// @inheritdoc IPriceOracle
    function getAssetPrice(address asset) public view returns (uint256) {
        FeedConfig memory cfg = _feeds[asset];
        if (address(cfg.feed) == address(0)) revert FeedNotConfigured(asset);

        (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound) =
            cfg.feed.latestRoundData();

        // Incomplete round: the aggregator has opened a round it has not answered yet.
        if (updatedAt == 0 || startedAt == 0) revert BadPrice(asset);
        // Carried-over answer from a previous round.
        if (answeredInRound < roundId) revert BadPrice(asset);
        // Non-positive answers are meaningless for a collateral price.
        if (answer <= 0) revert BadPrice(asset);

        // safe: `answer` is proven strictly positive above
        // forge-lint: disable-next-line(unsafe-typecast)
        uint256 raw = uint256(answer);
        if (raw < cfg.minAnswer || raw > cfg.maxAnswer) revert BadPrice(asset);

        // `updatedAt` in the future means a misbehaving aggregator; treat it as unusable.
        if (updatedAt > block.timestamp) revert BadPrice(asset);
        if (block.timestamp - updatedAt > cfg.heartbeat) revert StalePrice(asset, updatedAt);

        return raw * 1e18 / cfg.scale;
    }

    function feedConfig(address asset) external view returns (FeedConfig memory) {
        return _feeds[asset];
    }
}
