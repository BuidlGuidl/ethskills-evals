// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../contracts/Toolshed.sol";
import "../contracts/MockUSDC.sol";

interface Vm {
    function startBroadcast() external;
    function stopBroadcast() external;
}

contract Deploy {
    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function run() external returns (Toolshed shed, MockUSDC token) {
        vm.startBroadcast();
        token = new MockUSDC();
        shed = new Toolshed(address(token));
        vm.stopBroadcast();
    }
}
