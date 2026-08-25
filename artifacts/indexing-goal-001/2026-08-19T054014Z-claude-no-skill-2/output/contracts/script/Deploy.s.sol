// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {Streak} from "../src/Streak.sol";

/// @notice Deploys {Streak} and prints the two values the indexer needs:
///         the address and the deployment block. The indexer must start from
///         that block so it replays the contract's entire history.
contract Deploy is Script {
    function run() external returns (Streak streak) {
        vm.startBroadcast();
        streak = new Streak();
        vm.stopBroadcast();

        console.log("Streak deployed to:      %s", address(streak));
        console.log("Start block for indexer: %s", block.number);
        console.log("");
        console.log("Put these in indexer/.env.local:");
        console.log("  STREAK_ADDRESS=%s", address(streak));
        console.log("  STREAK_START_BLOCK=%s", block.number);
    }
}
