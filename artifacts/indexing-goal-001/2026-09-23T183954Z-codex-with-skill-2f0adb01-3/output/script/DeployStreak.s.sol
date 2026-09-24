// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Streak} from "../contracts/Streak.sol";

interface Vm {
    function envUint(string calldata name) external returns (uint256);
    function startBroadcast(uint256 privateKey) external;
    function stopBroadcast() external;
}

contract DeployStreak {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function run() external returns (Streak deployed) {
        uint256 privateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(privateKey);
        deployed = new Streak();
        vm.stopBroadcast();
    }
}
