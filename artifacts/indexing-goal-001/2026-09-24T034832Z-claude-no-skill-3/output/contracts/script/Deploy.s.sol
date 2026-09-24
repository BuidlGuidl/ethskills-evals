// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {Streak} from "../src/Streak.sol";

/// @notice Deploys Streak. Put the printed block in the indexer's
///         STREAK_START_BLOCK so the backfill starts at the contract's first day.
contract Deploy is Script {
    function run() external returns (Streak streak) {
        vm.startBroadcast();
        streak = new Streak();
        vm.stopBroadcast();

        console.log("Streak deployed to:      ", address(streak));
        // `block.number` here is the block the script simulated against, so the
        // real deployment lands in this block or the next one. Using it as
        // STREAK_START_BLOCK is safe: at worst the indexer scans one extra block.
        console.log("STREAK_START_BLOCK (>=):", block.number);
    }
}
