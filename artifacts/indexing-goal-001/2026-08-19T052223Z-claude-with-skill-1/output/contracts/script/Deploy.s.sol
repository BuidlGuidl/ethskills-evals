// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {Streak} from "../src/Streak.sol";

/// @notice Deploys Streak and prints the two values the indexer needs:
///         the address and the deploy block (its backfill start block).
contract Deploy is Script {
    function run() external returns (Streak streak) {
        vm.startBroadcast();
        streak = new Streak();
        vm.stopBroadcast();

        console.log("Streak deployed to:", address(streak));
        console.log("STREAK_START_BLOCK =", block.number);
        console.log("-> copy both into indexer/.env");
    }
}
