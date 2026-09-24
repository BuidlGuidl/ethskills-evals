// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { WeatherApiBilling, IERC20 } from "../src/WeatherApiBilling.sol";

interface Vm {
    function envAddress(string calldata name) external view returns (address);
    function startBroadcast() external;
    function stopBroadcast() external;
}

contract DeployWeatherBilling {
    Vm internal constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function run() external returns (WeatherApiBilling billing) {
        address usdc = vm.envAddress("USDC_ADDRESS");
        address owner = vm.envAddress("BILLING_OWNER");

        vm.startBroadcast();
        billing = new WeatherApiBilling(IERC20(usdc), owner);
        vm.stopBroadcast();
    }
}
