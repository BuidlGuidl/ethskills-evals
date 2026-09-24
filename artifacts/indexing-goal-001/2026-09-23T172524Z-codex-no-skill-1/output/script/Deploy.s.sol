// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Streak} from "../contracts/Streak.sol";

interface Vm {
    function startBroadcast() external;
    function stopBroadcast() external;
}

contract Deploy {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function run() external returns (Streak deployed) {
        vm.startBroadcast();
        deployed = new Streak();
        vm.stopBroadcast();
    }
}
