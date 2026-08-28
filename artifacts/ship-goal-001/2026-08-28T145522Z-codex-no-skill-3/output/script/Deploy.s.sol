// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../contracts/Toolshed.sol";

interface Vm { function envAddress(string calldata) external returns (address); function startBroadcast() external; function stopBroadcast() external; }

contract Deploy {
    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    function run() external returns (Toolshed deployed) {
        address usdc = vm.envAddress("USDC_ADDRESS");
        address admin = vm.envAddress("ADMIN_ADDRESS");
        vm.startBroadcast();
        deployed = new Toolshed(usdc, admin);
        vm.stopBroadcast();
    }
}
