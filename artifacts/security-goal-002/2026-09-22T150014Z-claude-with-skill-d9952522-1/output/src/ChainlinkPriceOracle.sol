// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IAggregatorV3} from "./interfaces/IAggregatorV3.sol";
import {IPriceOracle} from "./interfaces/IPriceOracle.sol";

/// @title ChainlinkPriceOracle
/// @notice Adapter that turns a single Chainlink USD feed into an 18-decimal price and refuses to
///         serve an answer that is stale, non-positive, or pinned against the aggregator's own
///         min/max answer bounds.
/// @dev One instance per feed. `maxAge` must be derived from *that feed's* published heartbeat plus
///      a margin for block/keeper jitter — there is deliberately no global default. `minPrice` and
///      `maxPrice` are a circuit breaker: if the underlying aggregator clamps at its configured
///      min/maxAnswer during a violent move, the clamped value is a lie and this adapter reverts
///      instead of letting the market price collateral off it.
contract ChainlinkPriceOracle is IPriceOracle {
    error InvalidConfig();
    error StalePrice(uint256 updatedAt, uint256 maxAge);
    error NonPositivePrice(int256 answer);
    error PriceOutOfBounds(uint256 price);

    /// @notice Underlying Chainlink aggregator proxy.
    IAggregatorV3 public immutable feed;
    /// @notice Maximum accepted age of `updatedAt`, in seconds.
    uint256 public immutable maxAge;
    /// @notice Lower sanity bound on the returned 18-decimal price (exclusive of aggregator clamps).
    uint256 public immutable minPrice;
    /// @notice Upper sanity bound on the returned 18-decimal price.
    uint256 public immutable maxPrice;

    /// @dev Multiplier that lifts a `feed.decimals()` answer to 18 decimals.
    uint256 private immutable _scaleUp;

    constructor(IAggregatorV3 feed_, uint256 maxAge_, uint256 minPrice_, uint256 maxPrice_) {
        if (address(feed_) == address(0)) revert InvalidConfig();
        // A heartbeat-derived bound. Anything longer than a day is not a staleness check.
        if (maxAge_ == 0 || maxAge_ > 1 days) revert InvalidConfig();
        if (minPrice_ == 0 || maxPrice_ <= minPrice_) revert InvalidConfig();

        uint8 feedDecimals = feed_.decimals();
        if (feedDecimals > 18) revert InvalidConfig();

        feed = feed_;
        maxAge = maxAge_;
        minPrice = minPrice_;
        maxPrice = maxPrice_;
        _scaleUp = 10 ** (18 - feedDecimals);
    }

    /// @inheritdoc IPriceOracle
    function price() external view returns (uint256) {
        (, int256 answer,, uint256 updatedAt,) = feed.latestRoundData();

        if (answer <= 0) revert NonPositivePrice(answer);
        // `updatedAt == 0` is an incomplete round; a future timestamp means a misbehaving feed.
        if (updatedAt == 0 || updatedAt > block.timestamp || block.timestamp - updatedAt > maxAge) {
            revert StalePrice(updatedAt, maxAge);
        }

        uint256 scaled = uint256(answer) * _scaleUp;
        if (scaled < minPrice || scaled > maxPrice) revert PriceOutOfBounds(scaled);

        return scaled;
    }
}
