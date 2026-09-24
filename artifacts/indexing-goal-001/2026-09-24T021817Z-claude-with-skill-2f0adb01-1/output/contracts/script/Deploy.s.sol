// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {Streak} from "../src/Streak.sol";

/// @notice Deploys Streak and prints the two values the subgraph needs:
///         the contract address and the deployment block (its `startBlock`).
contract Deploy is Script {
    function run() external returns (Streak streak) {
        vm.startBroadcast();
        streak = new Streak();
        vm.stopBroadcast();

        console.log("Streak deployed to:", address(streak));
        console.log("startBlock for subgraph.yaml:", block.number);
    }
}
