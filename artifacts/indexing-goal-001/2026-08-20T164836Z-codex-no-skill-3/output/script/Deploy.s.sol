// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Streak} from "../contracts/Streak.sol";

contract DeployStreak {
    Vm private constant VM = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function run() external returns (Streak streak) {
        VM.startBroadcast();
        streak = new Streak();
        VM.stopBroadcast();
    }
}

interface Vm {
    function startBroadcast() external;
    function stopBroadcast() external;
}
