// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ToolshedEscrow} from "../src/contracts/ToolshedEscrow.sol";

interface Vm { function envAddress(string calldata) external returns (address); function envUint(string calldata) external returns (uint256); function startBroadcast(uint256) external; function stopBroadcast() external; }

contract Deploy {
    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    function run() external returns (ToolshedEscrow deployed) {
        uint256 key = vm.envUint("PRIVATE_KEY");
        address usdc = vm.envAddress("USDC_ADDRESS");
        address admin = vm.envAddress("ADMIN_ADDRESS");
        vm.startBroadcast(key);
        deployed = new ToolshedEscrow(usdc, admin);
        vm.stopBroadcast();
    }
}
