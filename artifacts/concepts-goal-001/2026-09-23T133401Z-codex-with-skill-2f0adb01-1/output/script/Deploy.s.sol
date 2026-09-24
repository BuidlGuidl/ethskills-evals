// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {WeatherSubscription, IERC20} from "../src/WeatherSubscription.sol";

interface Vm {
    function envAddress(string calldata name) external view returns (address);
    function envOr(string calldata name, address defaultValue) external view returns (address);
    function startBroadcast() external;
    function stopBroadcast() external;
}

contract Deploy {
    Vm internal constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function run() external returns (WeatherSubscription subscription) {
        address usdc = vm.envAddress("USDC_ADDRESS");
        address owner = vm.envOr("OWNER_ADDRESS", msg.sender);

        vm.startBroadcast();
        subscription = new WeatherSubscription(IERC20(usdc), owner);
        vm.stopBroadcast();
    }
}
