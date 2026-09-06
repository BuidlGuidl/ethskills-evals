// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script} from "forge-std/Script.sol";

import {SimpleBorrowMarket} from "../src/SimpleBorrowMarket.sol";

contract DeploySimpleBorrowMarket is Script {
    function run() external returns (SimpleBorrowMarket market) {
        address weth = vm.envAddress("WETH");
        address usdc = vm.envAddress("USDC");
        address ethUsdOracle = vm.envAddress("ETH_USD_ORACLE");
        uint256 annualInterestRateWad = vm.envUint("ANNUAL_INTEREST_RATE_WAD");
        uint256 maxOracleAge = vm.envUint("MAX_ORACLE_AGE");

        vm.startBroadcast();
        market = new SimpleBorrowMarket(weth, usdc, ethUsdOracle, annualInterestRateWad, maxOracleAge);
        vm.stopBroadcast();
    }
}
