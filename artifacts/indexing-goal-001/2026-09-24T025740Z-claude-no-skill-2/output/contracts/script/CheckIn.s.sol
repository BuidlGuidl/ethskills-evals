// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {Streak} from "../src/Streak.sol";

/// @notice Sends a single check-in. Handy for smoke-testing a deployment.
/// @dev NOTE="gm" forge script script/CheckIn.s.sol --rpc-url $BASE_RPC_URL --broadcast
contract CheckIn is Script {
    function run() external {
        Streak streak = Streak(vm.envAddress("STREAK_ADDRESS"));
        string memory note = vm.envOr("NOTE", string("gm"));

        vm.startBroadcast();
        (uint32 day, uint32 s) = streak.checkIn(note);
        vm.stopBroadcast();

        console.log("Checked in for day", day, "streak", s);
    }
}
