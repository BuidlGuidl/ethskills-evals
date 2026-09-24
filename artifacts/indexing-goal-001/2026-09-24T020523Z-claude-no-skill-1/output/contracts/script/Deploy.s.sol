// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {Streak} from "../src/Streak.sol";

/// @notice Deploys Streak and prints the values the indexer needs (address + start block).
contract Deploy is Script {
    function run() external returns (Streak streak) {
        vm.startBroadcast();
        streak = new Streak();
        vm.stopBroadcast();

        console.log("Streak deployed at:", address(streak));
        console.log("startBlock for the indexer:", block.number);
        console.log("chainId:", block.chainid);
    }
}
