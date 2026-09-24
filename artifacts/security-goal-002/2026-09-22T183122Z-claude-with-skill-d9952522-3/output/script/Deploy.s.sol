// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {LendingPool} from "../src/LendingPool.sol";
import {ChainlinkPairOracle} from "../src/ChainlinkPairOracle.sol";
import {AggregatorV3Interface} from "../src/interfaces/AggregatorV3Interface.sol";
import {IPriceOracle} from "../src/interfaces/IPriceOracle.sol";

/// @notice Ethereum mainnet deployment. Every constant below is a deployment-time decision the
///         operator owns; see NOTES.md ("Operator checklist") before running this.
contract Deploy is Script {
    address constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address constant USDC = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;

    // Chainlink mainnet feeds. Heartbeats differ, hence the per-feed max ages.
    address constant ETH_USD_FEED = 0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419; // 1h heartbeat, 8 dec
    address constant USDC_USD_FEED = 0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6; // 24h heartbeat, 8 dec

    uint256 constant ETH_USD_MAX_AGE = 1 hours + 20 minutes; // heartbeat + margin
    uint256 constant USDC_USD_MAX_AGE = 24 hours + 1 hours; // heartbeat + margin

    // Sanity bands. MUST sit strictly inside each aggregator's own minAnswer/maxAnswer so a
    // clamped round reverts instead of being read as a real price. Verify on-chain before use.
    uint256 constant ETH_USD_MIN = 100e8;
    uint256 constant ETH_USD_MAX = 100_000e8;
    uint256 constant USDC_USD_MIN = 0.90e8;
    uint256 constant USDC_USD_MAX = 1.10e8;

    function run() external {
        // Must be a multisig or timelock, never the deployer EOA. See NOTES.md.
        address owner = vm.envAddress("POOL_OWNER");

        vm.startBroadcast();

        ChainlinkPairOracle oracle = new ChainlinkPairOracle(
            AggregatorV3Interface(ETH_USD_FEED),
            ETH_USD_MAX_AGE,
            ETH_USD_MIN,
            ETH_USD_MAX,
            AggregatorV3Interface(USDC_USD_FEED),
            USDC_USD_MAX_AGE,
            USDC_USD_MIN,
            USDC_USD_MAX
        );

        LendingPool pool = new LendingPool(
            LendingPool.InitParams({
                debtToken: IERC20(USDC),
                collateralToken: IERC20(WETH),
                oracle: IPriceOracle(address(oracle)),
                owner: owner,
                ltvBps: 7_000, // 70% max borrow
                liquidationThresholdBps: 8_500, // liquidatable above 85%
                liquidationBonusBps: 500, // 5% liquidator bonus
                closeFactorBps: 5_000, // at most half the debt per liquidation
                reserveFactorBps: 1_000, // 10% of interest to the protocol
                ratePerYearWad: 0.05e18 // flat 5% APR
            }),
            "WETH/USDC Pool Share",
            "wuUSDC"
        );

        vm.stopBroadcast();

        console2.log("oracle", address(oracle));
        console2.log("pool", address(pool));
    }
}
