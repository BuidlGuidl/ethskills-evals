// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {WeatherSubscriptions} from "../contracts/WeatherSubscriptions.sol";

interface Vm {
    function envAddress(string calldata key) external view returns (address value);
    function startBroadcast() external;
    function stopBroadcast() external;
}

contract Deploy {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function run() external returns (WeatherSubscriptions deployed) {
        address usdc = vm.envAddress("USDC_ADDRESS");
        address treasury = vm.envAddress("TREASURY_ADDRESS");

        vm.startBroadcast();
        deployed = new WeatherSubscriptions(usdc, treasury);
        vm.stopBroadcast();
    }
}

