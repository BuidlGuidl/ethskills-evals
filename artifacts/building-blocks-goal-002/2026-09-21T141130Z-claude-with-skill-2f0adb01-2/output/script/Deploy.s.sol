// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {AeroUsdcWethVault} from "../src/AeroUsdcWethVault.sol";
import {IAeroRouter, IAeroPool, IAeroGauge, IAeroVoter} from "../src/interfaces/IAerodrome.sol";
import {AggregatorV3Interface} from "../src/interfaces/AggregatorV3Interface.sol";
import {BaseAddresses as B} from "./BaseAddresses.sol";

/// Env: OWNER, KEEPER, TREASURY, DEPOSIT_CAP (USDC, 6 decimals).
contract Deploy is Script {
    function run() external returns (AeroUsdcWethVault vault) {
        require(block.chainid == 8453, "Base only");

        // Re-check the gauge against the Voter so a stale constant can't point us at a dead gauge.
        IAeroVoter voter = IAeroVoter(B.AERO_VOTER);
        address gauge = voter.gauges(B.VAMM_WETH_USDC);
        require(gauge == B.VAMM_WETH_USDC_GAUGE && voter.isAlive(gauge), "gauge mismatch");

        vm.startBroadcast();
        vault = new AeroUsdcWethVault(
            AeroUsdcWethVault.Config({
                usdc: IERC20(B.USDC),
                weth: IERC20(B.WETH),
                aero: IERC20(B.AERO),
                router: IAeroRouter(B.AERO_ROUTER),
                pool: IAeroPool(B.VAMM_WETH_USDC),
                gauge: IAeroGauge(gauge),
                ethUsdFeed: AggregatorV3Interface(B.ETH_USD_FEED),
                usdcUsdFeed: AggregatorV3Interface(B.USDC_USD_FEED),
                sequencerFeed: AggregatorV3Interface(B.SEQUENCER_UPTIME_FEED),
                ethUsdMaxAge: B.ETH_USD_MAX_AGE,
                usdcUsdMaxAge: B.USDC_USD_MAX_AGE,
                owner: vm.envAddress("OWNER"),
                keeper: vm.envAddress("KEEPER"),
                treasury: vm.envAddress("TREASURY"),
                depositCap: vm.envUint("DEPOSIT_CAP")
            })
        );
        vm.stopBroadcast();
        console.log("vault", address(vault));
    }
}
