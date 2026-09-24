// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {Streak} from "../src/Streak.sol";

contract Deploy is Script {
    function run() external returns (Streak streak) {
        vm.startBroadcast();
        streak = new Streak();
        vm.stopBroadcast();

        console2.log("Streak deployed at", address(streak));
        console2.log("Deploy block (use as subgraph startBlock)", block.number);
    }
}
