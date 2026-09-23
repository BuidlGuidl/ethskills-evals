// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {PrepaidBilling} from "../src/PrepaidBilling.sol";

/// @notice Deploys PrepaidBilling. Required env vars:
///   PRIVATE_KEY   - deployer key (becomes the revenue-withdrawal owner)
///   USDC_ADDRESS  - USDC token address on the target chain
contract Deploy is Script {
    function run() external {
        address usdc = vm.envAddress("USDC_ADDRESS");

        vm.startBroadcast();
        PrepaidBilling billing = new PrepaidBilling(usdc, 5e6, 20e6); // $5 hobby, $20 pro
        vm.stopBroadcast();

        console.log("PrepaidBilling deployed at:", address(billing));
        console.log("USDC:", usdc);
        console.log("Owner:", billing.owner());
    }
}
