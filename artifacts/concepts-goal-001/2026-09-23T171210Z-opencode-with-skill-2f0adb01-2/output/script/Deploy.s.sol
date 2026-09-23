// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {WeatherBilling} from "../src/WeatherBilling.sol";

/// @notice Deploys WeatherBilling. Configure with environment variables:
///
///   PRIVATE_KEY    key that pays deploy gas (does NOT need to be the owner)
///   OWNER_ADDRESS  revenue recipient — use a Safe or other cold wallet
///   USDC_ADDRESS   payment token — on Base mainnet the native USDC is
///                  0x833589fCD6eDb6E08f4c8ac72B70F2aF04879063 (verify before
///                  deploying: check the token contract on basescan.org)
///
/// Example:
///   PRIVATE_KEY=0x... OWNER_ADDRESS=0x... \
///   forge script script/Deploy.s.sol --rpc-url $BASE_RPC_URL --broadcast
contract DeployWeatherBilling is Script {
    function run() external returns (WeatherBilling billing) {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address owner = vm.envAddress("OWNER_ADDRESS");
        address usdc = vm.envAddress("USDC_ADDRESS");

        string[] memory names = new string[](2);
        names[0] = "hobby";
        names[1] = "pro";
        uint256[] memory prices = new uint256[](2);
        prices[0] = 5e6; // $5/month, USDC has 6 decimals
        prices[1] = 20e6; // $20/month

        vm.startBroadcast(deployerKey);
        billing = new WeatherBilling(IERC20(usdc), owner, names, prices);
        vm.stopBroadcast();

        console2.log("WeatherBilling deployed:", address(billing));
        console2.log("payment token:", usdc);
        console2.log("revenue owner:", owner);
    }
}