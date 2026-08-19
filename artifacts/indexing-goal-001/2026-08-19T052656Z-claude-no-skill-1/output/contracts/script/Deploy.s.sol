// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {Streak} from "../src/Streak.sol";

/// @notice Deploys Streak. Print the deployment block — the indexer needs it as
///         `startBlock` so it backfills the entire history and nothing before it.
contract Deploy is Script {
    function run() external returns (Streak streak) {
        vm.startBroadcast();
        streak = new Streak();
        vm.stopBroadcast();

        console.log("Streak deployed to:", address(streak));
        console.log("startBlock for the indexer:", block.number);
    }
}
