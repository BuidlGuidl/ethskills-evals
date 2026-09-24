// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IPriceOracle} from "./interfaces/IPriceOracle.sol";
import {AggregatorV3Interface} from "./interfaces/AggregatorV3Interface.sol";

/// @title ChainlinkOracle
/// @notice Reads a Chainlink ETH/USD aggregator and normalises it to 1e18-scaled USD.
/// @dev Deliberately immutable: the market's entire solvency rests on this number, so there is
///      no owner that can repoint the feed or widen the sanity bounds after deployment. Changing
///      any of it means deploying a new oracle and pointing the market at it (a governance action
///      that is visible onchain and timelockable).
contract ChainlinkOracle is IPriceOracle {
    /// @notice The Chainlink aggregator (use the ETH/USD feed's *proxy* address, not the
    ///         underlying aggregator, so feed upgrades are picked up).
    AggregatorV3Interface public immutable feed;

    /// @notice Maximum age of the latest answer, in seconds.
    uint256 public immutable maxStaleness;

    /// @notice Hard sanity bounds on the 1e18-scaled price. A feed that malfunctions and pins at
    ///         its min/max answer would otherwise be reported as truth.
    uint256 public immutable minPriceUsd;
    uint256 public immutable maxPriceUsd;

    /// @dev 10 ** (18 - feedDecimals). Fixed at deploy: a feed proxy that changes `decimals()`
    ///      later would silently rescale every price, so we pin it and verify at construction.
    uint256 private immutable _scaleUp;

    error InvalidConstructorArgs();
    error UnsupportedFeedDecimals(uint8 decimals);
    error StalePrice(uint256 updatedAt, uint256 maxStaleness);
    error IncompleteRound();
    error NonPositivePrice(int256 answer);
    error PriceOutOfBounds(uint256 price);

    constructor(address feed_, uint256 maxStaleness_, uint256 minPriceUsd_, uint256 maxPriceUsd_) {
        // A zero/huge staleness window or an inverted band would defeat the checks below.
        if (
            feed_ == address(0) || maxStaleness_ == 0 || maxStaleness_ > 1 days || minPriceUsd_ == 0
                || maxPriceUsd_ <= minPriceUsd_
        ) {
            revert InvalidConstructorArgs();
        }

        uint8 feedDecimals = AggregatorV3Interface(feed_).decimals();
        if (feedDecimals > 18) revert UnsupportedFeedDecimals(feedDecimals);

        feed = AggregatorV3Interface(feed_);
        maxStaleness = maxStaleness_;
        minPriceUsd = minPriceUsd_;
        maxPriceUsd = maxPriceUsd_;
        _scaleUp = 10 ** (18 - feedDecimals);

        // Fail fast if the feed is already unusable at deploy time.
        collateralPriceUsd();
    }

    /// @inheritdoc IPriceOracle
    function collateralPriceUsd() public view returns (uint256) {
        (uint80 roundId, int256 answer,, uint256 updatedAt, uint80 answeredInRound) = feed.latestRoundData();

        if (answer <= 0) revert NonPositivePrice(answer);
        // updatedAt == 0 means the round never closed; answeredInRound < roundId means the answer
        // is carried over from an earlier round.
        if (updatedAt == 0 || answeredInRound < roundId) revert IncompleteRound();
        // `updatedAt` can legitimately be a second or two ahead of `block.timestamp` across a
        // reorg; treat future timestamps as fresh rather than underflowing.
        if (updatedAt < block.timestamp && block.timestamp - updatedAt > maxStaleness) {
            revert StalePrice(updatedAt, maxStaleness);
        }

        // `answer > 0` is enforced above, so the cast cannot truncate.
        // forge-lint: disable-next-line(unsafe-typecast)
        uint256 price = uint256(answer) * _scaleUp;
        if (price < minPriceUsd || price > maxPriceUsd) revert PriceOutOfBounds(price);

        return price;
    }
}
