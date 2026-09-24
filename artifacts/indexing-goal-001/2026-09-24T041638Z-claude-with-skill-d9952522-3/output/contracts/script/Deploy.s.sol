// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {Streak} from "../src/Streak.sol";

contract Deploy is Script {
    function run() external returns (Streak streak) {
        vm.startBroadcast();
        streak = new Streak();
        vm.stopBroadcast();

        // Record both of these: the indexer needs the address and the deploy
        // block as its backfill start point.
        console.log("Streak deployed to:", address(streak));
        console.log("Deploy block:", block.number);
    }
}
