// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console2} from "forge-std/Script.sol";

import {BorrowMarket} from "../src/BorrowMarket.sol";
import {ChainlinkOracle} from "../src/ChainlinkOracle.sol";

/// @notice Mainnet deployment of the WETH/USDC borrow market.
/// @dev Run with:
///      forge script script/Deploy.s.sol --rpc-url $MAINNET_RPC --broadcast --verify
///      OWNER must be set to a timelocked multisig. See NOTES.md.
contract Deploy is Script {
    // Ethereum mainnet addresses.
    address constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address constant USDC = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;
    /// @dev Chainlink ETH/USD proxy. Heartbeat 3600s, deviation threshold 0.5%.
    address constant ETH_USD_FEED = 0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419;

    /// @dev Feed heartbeat is 1h; allow one missed heartbeat plus slack, no more.
    uint256 constant MAX_STALENESS = 1 hours + 15 minutes;
    /// @dev Circuit breaker on absurd prices. Widen only via a fresh oracle deployment.
    uint256 constant MIN_PRICE_USD = 100e18;
    uint256 constant MAX_PRICE_USD = 100_000e18;

    uint256 constant RATE_PER_YEAR = 0.05e18; // 5% APR, flat
    uint256 constant MAX_LTV_BPS = 7000; // 70%
    uint256 constant LIQ_THRESHOLD_BPS = 8500; // 85%
    uint256 constant LIQ_BONUS_BPS = 500; // 5%
    uint256 constant MIN_DEBT = 1000e6; // 1,000 USDC

    function run() external returns (ChainlinkOracle oracle, BorrowMarket market) {
        address owner = vm.envAddress("OWNER");
        require(owner != address(0), "OWNER unset");

        vm.startBroadcast();

        oracle = new ChainlinkOracle(ETH_USD_FEED, MAX_STALENESS, MIN_PRICE_USD, MAX_PRICE_USD);

        market = new BorrowMarket({
            owner_: owner,
            collateralToken_: WETH,
            borrowToken_: USDC,
            oracle_: address(oracle),
            ratePerYear_: RATE_PER_YEAR,
            maxLtvBps_: MAX_LTV_BPS,
            liquidationThresholdBps_: LIQ_THRESHOLD_BPS,
            liquidationBonusBps_: LIQ_BONUS_BPS,
            minDebt_: MIN_DEBT
        });

        vm.stopBroadcast();

        console2.log("oracle", address(oracle));
        console2.log("market", address(market));
        console2.log("price (1e18 USD/WETH)", oracle.collateralPriceUsd());
        console2.log("owner", market.owner());
    }
}
