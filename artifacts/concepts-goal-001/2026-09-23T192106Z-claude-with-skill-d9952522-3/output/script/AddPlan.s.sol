// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {Subscriptions} from "../src/Subscriptions.sol";

/// @notice Add a plan at a new price. This is how a price change happens: a new plan id
///         that new customers get and existing customers may switch to. It does not and
///         cannot reprice anyone already subscribed.
///
///         PRICE is in USDC units: $7.50 is 7500000.
contract AddPlan is Script {
    function run() external {
        Subscriptions sub = Subscriptions(vm.envAddress("SUBSCRIPTIONS"));
        uint128 price = uint128(vm.envUint("PRICE"));
        uint64 period = uint64(vm.envOr("PERIOD", uint256(30 days)));

        vm.broadcast();
        uint32 planId = sub.addPlan(price, period);
        console.log("added plan %s at %s per %s seconds", planId, price, period);
        console.log("close the old plan with ClosePlan.s.sol when you are ready");
    }
}
