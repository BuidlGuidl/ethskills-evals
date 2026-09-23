// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {WeatherBilling} from "../src/WeatherBilling.sol";

interface Vm {
    function envUint(string calldata) external returns (uint256);
    function envAddress(string calldata) external returns (address);
    function envOr(string calldata, uint256) external returns (uint256);
    function startBroadcast(uint256) external;
    function stopBroadcast() external;
}

contract Deploy {
    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function run() external returns (WeatherBilling billing) {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address owner = vm.envAddress("OWNER_ADDRESS");
        address usdc = vm.envAddress("USDC_ADDRESS");
        uint256 hobbyPrice = vm.envOr("HOBBY_PRICE", 5_000_000);
        uint256 proPrice = vm.envOr("PRO_PRICE", 20_000_000);

        vm.startBroadcast(deployerKey);
        billing = new WeatherBilling(owner, usdc, hobbyPrice, proPrice);
        vm.stopBroadcast();
    }
}
