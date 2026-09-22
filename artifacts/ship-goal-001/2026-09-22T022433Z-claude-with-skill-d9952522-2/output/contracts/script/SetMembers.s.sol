// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {Toolshed} from "../src/Toolshed.sol";

/// @notice Adds or removes roster members. Must be broadcast by the steward.
///
/// Env:
///   TOOLSHED_ADDRESS  required
///   MEMBERS           required - comma-separated addresses
///   MEMBER_INCLUDED   optional - "true" (default) to add, "false" to remove
contract SetMembers is Script {
    function run() external {
        Toolshed shed = Toolshed(vm.envAddress("TOOLSHED_ADDRESS"));
        address[] memory members = vm.envAddress("MEMBERS", ",");
        bool included = vm.envOr("MEMBER_INCLUDED", true);

        console.log(included ? "adding members:" : "removing members:", members.length);

        vm.startBroadcast();
        shed.setMembers(members, included);
        vm.stopBroadcast();
    }
}
