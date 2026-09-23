// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20, WeatherSubscriptions} from "../contracts/WeatherSubscriptions.sol";

interface Vm {
    function envAddress(string calldata name) external view returns (address);
    function startBroadcast() external;
    function stopBroadcast() external;
}

contract DeployWeatherSubscriptions {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function run() external returns (WeatherSubscriptions deployed) {
        address usdc = vm.envAddress("USDC_ADDRESS");
        address treasury = vm.envAddress("TREASURY_ADDRESS");

        vm.startBroadcast();
        deployed = new WeatherSubscriptions(IERC20(usdc), treasury);
        vm.stopBroadcast();
    }
}
