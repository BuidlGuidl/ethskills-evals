// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {ChainlinkPriceOracle} from "../src/ChainlinkPriceOracle.sol";
import {IAggregatorV3} from "../src/interfaces/IAggregatorV3.sol";
import {LendingPool} from "../src/LendingPool.sol";

/// @notice Mainnet deployment. Every address and bound below is a decision, not a default —
///         re-check each one against NOTES.md before broadcasting.
contract Deploy is Script {
    // Mainnet tokens.
    address constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address constant USDC = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;

    // Chainlink mainnet aggregator proxies.
    address constant ETH_USD_FEED = 0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419;
    address constant USDC_USD_FEED = 0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6;

    // Published heartbeats: ETH/USD 3600s (0.5% deviation), USDC/USD 86400s (0.25% deviation).
    // Margin added for keeper/block jitter. USDC/USD's day-long heartbeat is the reason the
    // circuit-breaker bounds below matter more than the age check on that feed.
    uint256 constant ETH_FEED_MAX_AGE = 3600 + 900;
    uint256 constant USDC_FEED_MAX_AGE = 86_400; // adapter caps maxAge at 1 day

    function run() external {
        address owner = vm.envAddress("OWNER"); // MUST be a multisig or timelock.

        vm.startBroadcast();

        ChainlinkPriceOracle ethOracle = new ChainlinkPriceOracle(
            IAggregatorV3(ETH_USD_FEED),
            ETH_FEED_MAX_AGE,
            100e18, // reject below $100/ETH
            100_000e18 // reject above $100k/ETH
        );
        ChainlinkPriceOracle usdcOracle = new ChainlinkPriceOracle(
            IAggregatorV3(USDC_USD_FEED),
            USDC_FEED_MAX_AGE,
            0.90e18, // a depeg past these bounds stops the market rather than mispricing debt
            1.10e18
        );

        LendingPool pool = new LendingPool(
            LendingPool.Params({
                collateralToken: IERC20(WETH),
                debtToken: IERC20(USDC),
                collateralOracle: ethOracle,
                debtOracle: usdcOracle,
                maxLtvBps: 7_000, // 70%
                liquidationThresholdBps: 8_500, // 85%
                liquidationBonusBps: 500, // 5%
                closeFactorBps: 5_000, // 50% per liquidation while solvent
                annualRateWad: 0.05e18, // 5%/year flat
                minDebt: 100e6, // 100 USDC
                owner: owner
            })
        );

        vm.stopBroadcast();

        console2.log("ethOracle ", address(ethOracle));
        console2.log("usdcOracle", address(usdcOracle));
        console2.log("pool      ", address(pool));
    }
}
