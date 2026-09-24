// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {Subscriptions} from "../src/Subscriptions.sol";

/// @notice Stop new signups on a plan. Existing subscribers on it are untouched: same
///         price, same balance, same expiry, and they keep it until they leave.
contract ClosePlan is Script {
    function run() external {
        Subscriptions sub = Subscriptions(vm.envAddress("SUBSCRIPTIONS"));
        uint32 planId = uint32(vm.envUint("PLAN_ID"));
        bool open = vm.envOr("OPEN", false);

        vm.broadcast();
        sub.setPlanOpen(planId, open);
        console.log("plan %s open = %s", planId, open);
    }
}
