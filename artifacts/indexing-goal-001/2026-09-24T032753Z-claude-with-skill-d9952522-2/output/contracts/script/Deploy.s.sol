// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {Streak} from "../src/Streak.sol";

/// @notice Deploys Streak and prints the two values the indexer needs:
///         the contract address and the deployment block.
contract Deploy is Script {
    function run() external returns (Streak streak) {
        vm.startBroadcast();
        streak = new Streak();
        vm.stopBroadcast();

        console.log("Streak deployed to:", address(streak));
        console.log("Start block for indexer (STREAK_START_BLOCK):", block.number);
    }
}
