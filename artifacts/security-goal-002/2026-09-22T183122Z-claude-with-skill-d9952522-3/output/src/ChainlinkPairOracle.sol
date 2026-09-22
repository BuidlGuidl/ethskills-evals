// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {AggregatorV3Interface} from "./interfaces/AggregatorV3Interface.sol";
import {IPriceOracle} from "./interfaces/IPriceOracle.sol";

/**
 * @title ChainlinkPairOracle
 * @notice Prices the collateral asset in units of the debt asset by dividing two Chainlink
 *         USD feeds (e.g. ETH/USD divided by USDC/USD).
 *
 * @dev Design notes:
 *      - Both legs are validated independently. Each feed carries its own max age, because
 *        heartbeats differ per feed (mainnet ETH/USD is 1h, USDC/USD is 24h). A single global
 *        timeout would either reject fresh USDC rounds or accept badly stale ETH rounds.
 *      - The debt leg is priced too rather than assumed to be exactly $1. A depegged stablecoin
 *        that is hardcoded to 1.0 systematically misprices every position in the market.
 *      - Both legs are sanity-bounded. Chainlink aggregators clamp their reported answer to the
 *        underlying aggregator's minAnswer/maxAnswer; if the true price leaves that band the feed
 *        keeps publishing the clamped bound as if it were fresh and correct. Bounds configured
 *        here are strictly inside the aggregator band so a clamped round reverts instead of
 *        being consumed.
 *      - Everything here is view-only and immutable. There is no owner and no setter, so the
 *        oracle cannot be repointed after deployment; the pool owner swaps the whole oracle.
 */
contract ChainlinkPairOracle is IPriceOracle {
    using Math for uint256;

    uint256 internal constant WAD = 1e18;

    AggregatorV3Interface public immutable collateralFeed;
    AggregatorV3Interface public immutable debtFeed;

    uint256 public immutable collateralFeedMaxAge;
    uint256 public immutable debtFeedMaxAge;

    uint256 public immutable collateralMinAnswer;
    uint256 public immutable collateralMaxAnswer;
    uint256 public immutable debtMinAnswer;
    uint256 public immutable debtMaxAnswer;

    uint256 internal immutable collateralFeedScale;
    uint256 internal immutable debtFeedScale;

    error InvalidConfig();
    error StalePrice(address feed, uint256 updatedAt);
    error NonPositivePrice(address feed, int256 answer);
    error PriceOutOfBounds(address feed, uint256 price);

    constructor(
        AggregatorV3Interface _collateralFeed,
        uint256 _collateralFeedMaxAge,
        uint256 _collateralMinAnswer,
        uint256 _collateralMaxAnswer,
        AggregatorV3Interface _debtFeed,
        uint256 _debtFeedMaxAge,
        uint256 _debtMinAnswer,
        uint256 _debtMaxAnswer
    ) {
        if (address(_collateralFeed) == address(0) || address(_debtFeed) == address(0)) revert InvalidConfig();
        if (_collateralFeedMaxAge == 0 || _debtFeedMaxAge == 0) revert InvalidConfig();
        if (_collateralMinAnswer == 0 || _collateralMinAnswer >= _collateralMaxAnswer) revert InvalidConfig();
        if (_debtMinAnswer == 0 || _debtMinAnswer >= _debtMaxAnswer) revert InvalidConfig();

        collateralFeed = _collateralFeed;
        debtFeed = _debtFeed;
        collateralFeedMaxAge = _collateralFeedMaxAge;
        debtFeedMaxAge = _debtFeedMaxAge;
        collateralMinAnswer = _collateralMinAnswer;
        collateralMaxAnswer = _collateralMaxAnswer;
        debtMinAnswer = _debtMinAnswer;
        debtMaxAnswer = _debtMaxAnswer;

        uint8 collateralDecimals = _collateralFeed.decimals();
        uint8 debtDecimals = _debtFeed.decimals();
        if (collateralDecimals > 36 || debtDecimals > 36) revert InvalidConfig();

        collateralFeedScale = 10 ** collateralDecimals;
        debtFeedScale = 10 ** debtDecimals;
    }

    /// @inheritdoc IPriceOracle
    function collateralPriceInDebt() external view returns (uint256) {
        uint256 collateralUsd = _read(collateralFeed, collateralFeedMaxAge, collateralMinAnswer, collateralMaxAnswer);
        uint256 debtUsd = _read(debtFeed, debtFeedMaxAge, debtMinAnswer, debtMaxAnswer);

        // (collateralUsd / collateralFeedScale) / (debtUsd / debtFeedScale), scaled to 1e18.
        return Math.mulDiv(collateralUsd * WAD, debtFeedScale, debtUsd * collateralFeedScale);
    }

    function _read(AggregatorV3Interface feed, uint256 maxAge, uint256 minAnswer, uint256 maxAnswer)
        internal
        view
        returns (uint256)
    {
        (, int256 answer,, uint256 updatedAt,) = feed.latestRoundData();

        if (answer <= 0) revert NonPositivePrice(address(feed), answer);
        // updatedAt == 0 means the round was never completed; a future timestamp means a broken feed.
        if (updatedAt == 0 || updatedAt > block.timestamp) revert StalePrice(address(feed), updatedAt);
        if (block.timestamp - updatedAt > maxAge) revert StalePrice(address(feed), updatedAt);

        uint256 price = uint256(answer);
        if (price <= minAnswer || price >= maxAnswer) revert PriceOutOfBounds(address(feed), price);

        return price;
    }
}
