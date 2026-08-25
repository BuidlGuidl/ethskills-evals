// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {Streak} from "../src/Streak.sol";

/// @notice Deploys Streak and prints the address and deployment block. Feed both
///         into the indexer's STREAK_ADDRESS / STREAK_START_BLOCK.
contract Deploy is Script {
    function run() external returns (Streak streak) {
        vm.startBroadcast();
        streak = new Streak();
        vm.stopBroadcast();

        console.log("Streak deployed to:", address(streak));
        console.log("Deployment block  :", block.number);
        console.log("");
        console.log("Set in indexer/.env.local:");
        console.log("  STREAK_ADDRESS=%s", address(streak));
        console.log("  STREAK_START_BLOCK=%s", block.number);
    }
}
