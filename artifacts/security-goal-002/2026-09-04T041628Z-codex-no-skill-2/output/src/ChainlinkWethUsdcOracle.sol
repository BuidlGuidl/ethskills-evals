// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {AggregatorV3Interface} from "./interfaces/AggregatorV3Interface.sol";
import {IPriceOracle} from "./interfaces/IPriceOracle.sol";

contract ChainlinkWethUsdcOracle is IPriceOracle {
    error InvalidPrice();
    error InvalidOracleDecimals();
    error StalePrice();

    AggregatorV3Interface public immutable WETH_USD_FEED;
    AggregatorV3Interface public immutable USDC_USD_FEED;
    uint256 public immutable MAX_ORACLE_DELAY;

    constructor(address wethUsdFeed_, address usdcUsdFeed_, uint256 maxOracleDelay_) {
        WETH_USD_FEED = AggregatorV3Interface(wethUsdFeed_);
        USDC_USD_FEED = AggregatorV3Interface(usdcUsdFeed_);
        MAX_ORACLE_DELAY = maxOracleDelay_;
    }

    function wethPriceInUsdc() external view returns (uint256 priceE8, uint256 updatedAt) {
        (, int256 wethUsdAnswer,, uint256 wethUpdatedAt,) = WETH_USD_FEED.latestRoundData();
        (, int256 usdcUsdAnswer,, uint256 usdcUpdatedAt,) = USDC_USD_FEED.latestRoundData();

        if (wethUsdAnswer <= 0 || usdcUsdAnswer <= 0) revert InvalidPrice();
        if (WETH_USD_FEED.decimals() != 8 || USDC_USD_FEED.decimals() != 8) revert InvalidOracleDecimals();
        if (block.timestamp - wethUpdatedAt > MAX_ORACLE_DELAY || block.timestamp - usdcUpdatedAt > MAX_ORACLE_DELAY) {
            revert StalePrice();
        }

        // forge-lint: disable-next-line(unsafe-typecast)
        priceE8 = (uint256(wethUsdAnswer) * 1e8) / uint256(usdcUsdAnswer);
        updatedAt = wethUpdatedAt < usdcUpdatedAt ? wethUpdatedAt : usdcUpdatedAt;
    }
}
