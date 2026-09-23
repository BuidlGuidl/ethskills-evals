// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {WeatherBilling} from "../src/WeatherBilling.sol";

contract Deploy is Script {
    function run() external returns (WeatherBilling billingContract) {
        address usdcToken = vm.envAddress("USDC");
        address operatorAddr = vm.envAddress("OPERATOR");
        vm.startBroadcast();
        billingContract = new WeatherBilling(usdcToken, operatorAddr);
        vm.stopBroadcast();
        console2.log("WeatherBilling:", address(billingContract));
        console2.log("USDC:", usdcToken);
        console2.log("operator:", operatorAddr);
    }
}