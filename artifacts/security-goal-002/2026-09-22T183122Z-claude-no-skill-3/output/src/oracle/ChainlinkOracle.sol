// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";

import {IAggregatorV3} from "../interfaces/IAggregatorV3.sol";
import {IPriceOracle} from "../interfaces/IPriceOracle.sol";

/// @title ChainlinkOracle
/// @notice Adapts a Chainlink USD-quoted price feed (e.g. mainnet ETH/USD) to the 18-decimal
///         {IPriceOracle} interface used by the lending pool.
/// @dev Every read is validated. A feed that is stale, non-positive, or pinned against its
///      aggregator's circuit-breaker bounds makes this contract revert, which in turn freezes the
///      pool's price-sensitive entrypoints. Freezing is deliberate: an unchecked feed is how
///      lending markets get drained, and a paused market is recoverable while a mispriced one is
///      not.
contract ChainlinkOracle is IPriceOracle, Ownable2Step {
    /// @notice The underlying Chainlink aggregator proxy.
    IAggregatorV3 public immutable feed;

    /// @notice Decimals reported by the feed at construction time.
    uint8 public immutable feedDecimals;

    /// @notice Maximum age of an answer, in seconds, before it is considered stale.
    /// @dev Must be set above the feed's advertised heartbeat plus a margin for block-time
    ///      jitter; see NOTES.md.
    uint256 public maxAge;

    /// @notice Inclusive sanity bounds on the 18-decimal price. Reads outside the band revert.
    /// @dev These exist to catch the case where the aggregator saturates at its own minAnswer /
    ///      maxAnswer during a violent move and keeps reporting a price that is no longer real.
    uint256 public minPrice;
    uint256 public maxPrice;

    event MaxAgeSet(uint256 maxAge);
    event PriceBoundsSet(uint256 minPrice, uint256 maxPrice);

    error InvalidFeed();
    error InvalidConfig();
    error StalePrice(uint256 updatedAt, uint256 maxAge);
    error NonPositivePrice(int256 answer);
    error PriceOutOfBounds(uint256 price, uint256 minPrice, uint256 maxPrice);

    constructor(address owner_, IAggregatorV3 feed_, uint256 maxAge_, uint256 minPrice_, uint256 maxPrice_)
        Ownable(owner_)
    {
        if (address(feed_) == address(0)) revert InvalidFeed();
        uint8 decimals_ = feed_.decimals();
        // Feeds with more than 18 decimals would need a divide-down path we do not implement.
        if (decimals_ == 0 || decimals_ > 18) revert InvalidFeed();

        feed = feed_;
        feedDecimals = decimals_;

        _setMaxAge(maxAge_);
        _setPriceBounds(minPrice_, maxPrice_);

        // Fail fast at deploy time rather than at the first borrow.
        price();
    }

    /// @inheritdoc IPriceOracle
    function price() public view returns (uint256) {
        (, int256 answer,, uint256 updatedAt,) = feed.latestRoundData();

        if (answer <= 0) revert NonPositivePrice(answer);
        // `updatedAt == 0` marks an incomplete round; it is caught by the staleness check below
        // because `block.timestamp - 0` is always greater than any sane `maxAge`.
        if (updatedAt > block.timestamp || block.timestamp - updatedAt > maxAge) {
            revert StalePrice(updatedAt, maxAge);
        }

        // Safe: `answer > 0` was checked above, so the cast cannot wrap.
        // forge-lint: disable-next-line(unsafe-typecast)
        uint256 scaled = uint256(answer) * (10 ** (18 - feedDecimals));

        if (scaled < minPrice || scaled > maxPrice) revert PriceOutOfBounds(scaled, minPrice, maxPrice);

        return scaled;
    }

    function setMaxAge(uint256 maxAge_) external onlyOwner {
        _setMaxAge(maxAge_);
    }

    function setPriceBounds(uint256 minPrice_, uint256 maxPrice_) external onlyOwner {
        _setPriceBounds(minPrice_, maxPrice_);
    }

    function _setMaxAge(uint256 maxAge_) internal {
        // An unbounded maxAge would silently disable the staleness check.
        if (maxAge_ == 0 || maxAge_ > 7 days) revert InvalidConfig();
        maxAge = maxAge_;
        emit MaxAgeSet(maxAge_);
    }

    function _setPriceBounds(uint256 minPrice_, uint256 maxPrice_) internal {
        if (minPrice_ == 0 || minPrice_ >= maxPrice_) revert InvalidConfig();
        minPrice = minPrice_;
        maxPrice = maxPrice_;
        emit PriceBoundsSet(minPrice_, maxPrice_);
    }
}
