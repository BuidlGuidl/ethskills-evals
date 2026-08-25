// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {Streak} from "../src/Streak.sol";

/// @notice Deploys Streak and prints the address + block the indexer needs.
///
/// Usage:
///   forge script script/Deploy.s.sol:Deploy \
///     --rpc-url $BASE_RPC_URL --account deployer --broadcast --verify
contract Deploy is Script {
    function run() external returns (Streak streak) {
        vm.startBroadcast();
        streak = new Streak();
        vm.stopBroadcast();

        console.log("Streak deployed at:", address(streak));
        console.log("Start block for the indexer:", block.number);
        console.log("");
        console.log("Copy these into indexer/.env.local:");
        console.log("  STREAK_ADDRESS=%s", address(streak));
        console.log("  STREAK_START_BLOCK=%s", block.number);
    }
}
