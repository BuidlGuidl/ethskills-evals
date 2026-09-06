// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script} from "lib/openzeppelin-contracts/lib/forge-std/src/Script.sol";

import {ETHBorrowMarket} from "../src/ETHBorrowMarket.sol";

contract Deploy is Script {
    function run() external returns (ETHBorrowMarket market) {
        address weth = vm.envAddress("WETH");
        address usdc = vm.envAddress("USDC");
        address collateralOracle = vm.envAddress("COLLATERAL_ORACLE");
        uint256 annualInterestBps = vm.envUint("ANNUAL_INTEREST_BPS");
        uint256 oracleMaxAge = vm.envUint("ORACLE_MAX_AGE");

        vm.startBroadcast();
        market = new ETHBorrowMarket(
            weth,
            usdc,
            collateralOracle,
            annualInterestBps,
            oracleMaxAge
        );
        vm.stopBroadcast();
    }
}

