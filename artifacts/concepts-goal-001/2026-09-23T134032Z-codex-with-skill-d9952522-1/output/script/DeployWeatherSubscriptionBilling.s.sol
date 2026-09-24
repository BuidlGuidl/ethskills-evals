// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {WeatherSubscriptionBilling} from "../src/WeatherSubscriptionBilling.sol";

interface Vm {
    function envAddress(string calldata name) external view returns (address);
    function startBroadcast() external;
    function stopBroadcast() external;
}

contract DeployWeatherSubscriptionBilling {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function run() external returns (WeatherSubscriptionBilling billing) {
        address usdc = vm.envAddress("USDC_ADDRESS");
        address treasury = vm.envAddress("TREASURY_ADDRESS");

        vm.startBroadcast();
        billing = new WeatherSubscriptionBilling(usdc, treasury);
        vm.stopBroadcast();
    }
}

