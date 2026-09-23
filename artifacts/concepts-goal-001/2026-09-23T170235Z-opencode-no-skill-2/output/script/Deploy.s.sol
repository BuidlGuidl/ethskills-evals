// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {Billing} from "../src/Billing.sol";

contract Deploy is Script {
    function run() external returns (Billing billing) {
        address usdc = vm.envAddress("USDC_ADDRESS");

        vm.startBroadcast();
        address owner = vm.envOr("OWNER_ADDRESS", msg.sender);
        billing = new Billing(usdc, owner);
        vm.stopBroadcast();
    }
}
