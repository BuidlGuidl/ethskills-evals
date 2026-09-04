// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {AggregatorV3Interface, BorrowingMarket} from "../src/BorrowingMarket.sol";

contract DeployBorrowingMarket is Script {
    function run() external returns (BorrowingMarket market) {
        address owner = vm.envAddress("OWNER");
        address weth = vm.envAddress("WETH");
        address usdc = vm.envAddress("USDC");
        address ethUsdOracle = vm.envAddress("ETH_USD_ORACLE");
        uint256 annualInterestBps = vm.envUint("ANNUAL_INTEREST_BPS");
        uint256 maxOracleAge = vm.envUint("MAX_ORACLE_AGE");

        vm.startBroadcast();
        market = new BorrowingMarket(
            owner,
            IERC20(weth),
            IERC20(usdc),
            AggregatorV3Interface(ethUsdOracle),
            annualInterestBps,
            maxOracleAge
        );
        vm.stopBroadcast();
    }
}
