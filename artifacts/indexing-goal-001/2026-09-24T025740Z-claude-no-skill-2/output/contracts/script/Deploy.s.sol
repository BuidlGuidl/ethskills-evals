// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {Streak} from "../src/Streak.sol";

/// @notice Deploys the Streak contract.
/// @dev forge script script/Deploy.s.sol --rpc-url $BASE_RPC_URL --broadcast --verify
///      Record the printed address and block number: the indexer needs both.
contract Deploy is Script {
    function run() external returns (Streak streak) {
        vm.startBroadcast();
        streak = new Streak();
        vm.stopBroadcast();

        console.log("Streak deployed at:", address(streak));
        console.log("Deployment block:  ", block.number);
        console.log("Put these in indexer/.env.local as STREAK_ADDRESS / STREAK_START_BLOCK");
    }
}
