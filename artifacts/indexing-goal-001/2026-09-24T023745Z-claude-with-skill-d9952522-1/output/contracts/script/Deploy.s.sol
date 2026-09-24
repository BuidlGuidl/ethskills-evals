// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {Streak} from "../src/Streak.sol";

/// @notice Deploys {Streak} and prints the two values the indexer needs:
///         the address and the deployment block.
/// @dev The indexer backfills from `startBlock`, so record the printed block
///      number in indexer/.env — starting later silently loses history.
contract Deploy is Script {
    function run() external returns (Streak streak) {
        // 0 = days roll over at 00:00 UTC. Set DAY_OFFSET_SECONDS to shift it.
        int256 dayOffset = vm.envOr("DAY_OFFSET_SECONDS", int256(0));
        uint256 deployBlock;

        vm.startBroadcast();
        streak = new Streak(dayOffset);
        deployBlock = block.number;
        vm.stopBroadcast();

        console.log("Streak deployed");
        console.log("  STREAK_ADDRESS   =", address(streak));
        console.log("  STREAK_START_BLOCK =", deployBlock);
        console.log("  dayOffsetSeconds =", dayOffset);
    }
}
