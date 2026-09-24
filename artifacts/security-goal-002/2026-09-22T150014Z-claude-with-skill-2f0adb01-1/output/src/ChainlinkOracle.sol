// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {AggregatorV3Interface} from "./interfaces/AggregatorV3Interface.sol";
import {IPriceOracle} from "./interfaces/IPriceOracle.sol";

/// @title ChainlinkOracle
/// @notice Reads two Chainlink USD feeds (collateral/USD and debt/USD) and normalises both
///         answers to 18 decimals.
/// @dev Every parameter is immutable on purpose: there is no owner and therefore no way for a
///      compromised key to point the market at a fake price feed. Re-pricing the market means
///      deploying a new oracle and a new market.
///
///      Prices are *never* taken from a DEX spot pool: a single flash loan can move a pool price
///      inside one transaction, which is exactly what a borrowing market must not be exposed to.
contract ChainlinkOracle is IPriceOracle {
    /// @notice Feed for the collateral asset (e.g. ETH/USD on mainnet).
    AggregatorV3Interface public immutable collateralFeed;
    /// @notice Feed for the debt asset (e.g. USDC/USD on mainnet).
    AggregatorV3Interface public immutable debtFeed;

    /// @notice Maximum age of a collateral answer before it is treated as stale, in seconds.
    uint256 public immutable collateralMaxAge;
    /// @notice Maximum age of a debt answer before it is treated as stale, in seconds.
    uint256 public immutable debtMaxAge;

    /// @dev 10 ** (18 - feed.decimals()), used to scale an answer up to 18 decimals.
    uint256 private immutable collateralScale;
    uint256 private immutable debtScale;

    /// @dev Absolute sanity bounds. They only catch a feed that has gone completely off the rails
    ///      (returns 0, or a price 1e9x away from anything real); they are not a price band.
    uint256 private constant MIN_PRICE = 1e6; // 1e-12 USD
    uint256 private constant MAX_PRICE = 1e30; // 1e12 USD

    error ZeroAddress();
    error BadMaxAge();
    error UnsupportedFeedDecimals(uint8 decimals);
    error InvalidPrice(address feed, int256 answer);
    error IncompleteRound(address feed);
    error StalePrice(address feed, uint256 updatedAt, uint256 maxAge);

    constructor(
        AggregatorV3Interface _collateralFeed,
        uint256 _collateralMaxAge,
        AggregatorV3Interface _debtFeed,
        uint256 _debtMaxAge
    ) {
        if (address(_collateralFeed) == address(0) || address(_debtFeed) == address(0)) revert ZeroAddress();
        // A max age of zero would make every read revert; anything above a day is not a
        // meaningful staleness check for the feeds this market is built for.
        if (_collateralMaxAge == 0 || _collateralMaxAge > 2 days) revert BadMaxAge();
        if (_debtMaxAge == 0 || _debtMaxAge > 2 days) revert BadMaxAge();

        collateralFeed = _collateralFeed;
        debtFeed = _debtFeed;
        collateralMaxAge = _collateralMaxAge;
        debtMaxAge = _debtMaxAge;

        uint8 cDecimals = _collateralFeed.decimals();
        uint8 dDecimals = _debtFeed.decimals();
        if (cDecimals > 18) revert UnsupportedFeedDecimals(cDecimals);
        if (dDecimals > 18) revert UnsupportedFeedDecimals(dDecimals);

        collateralScale = 10 ** (18 - cDecimals);
        debtScale = 10 ** (18 - dDecimals);
    }

    /// @inheritdoc IPriceOracle
    function collateralPrice() external view returns (uint256) {
        return _read(collateralFeed, collateralMaxAge, collateralScale);
    }

    /// @inheritdoc IPriceOracle
    function debtPrice() external view returns (uint256) {
        return _read(debtFeed, debtMaxAge, debtScale);
    }

    function _read(AggregatorV3Interface feed, uint256 maxAge, uint256 scale)
        private
        view
        returns (uint256 price)
    {
        (uint80 roundId, int256 answer,, uint256 updatedAt, uint80 answeredInRound) = feed.latestRoundData();

        if (answer <= 0) revert InvalidPrice(address(feed), answer);
        // updatedAt == 0 or a round id from the past means the answer was never finalised.
        if (updatedAt == 0 || answeredInRound < roundId) revert IncompleteRound(address(feed));
        // A future timestamp is nonsense; treat it as unusable rather than as "very fresh".
        if (updatedAt > block.timestamp) revert IncompleteRound(address(feed));
        if (block.timestamp - updatedAt > maxAge) revert StalePrice(address(feed), updatedAt, maxAge);

        price = uint256(answer) * scale;
        if (price < MIN_PRICE || price > MAX_PRICE) revert InvalidPrice(address(feed), answer);
    }
}
