// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20, WeatherSubscriptions} from "../contracts/WeatherSubscriptions.sol";

interface Vm {
    function envAddress(string calldata name) external view returns (address value);
    function startBroadcast() external;
    function stopBroadcast() external;
}

contract DeployWeatherSubscriptions {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function run() external returns (WeatherSubscriptions subscription) {
        address usdc = vm.envAddress("USDC_ADDRESS");
        address owner = vm.envAddress("OWNER_ADDRESS");

        vm.startBroadcast();
        subscription = new WeatherSubscriptions(IERC20(usdc), owner);
        vm.stopBroadcast();
    }
}
