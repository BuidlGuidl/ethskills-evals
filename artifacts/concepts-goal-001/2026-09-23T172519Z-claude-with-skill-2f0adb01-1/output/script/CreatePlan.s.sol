// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Vm, VM_ADDRESS} from "./Vm.sol";
import {SubscriptionBilling} from "../src/SubscriptionBilling.sol";

/// @notice Adds a plan to a live deployment. This is also how you reprice: create a
/// new plan at the new price, then `closePlan` the old one. Existing subscribers keep
/// their original rate until they choose to switch — by design.
///
///   export BILLING=0x...  PRICE=7000000  PLAN_NAME="hobby v2"
///   forge script script/CreatePlan.s.sol --rpc-url $RPC_URL --broadcast
contract CreatePlan {
    Vm internal constant vm = Vm(VM_ADDRESS);

    function run() external {
        SubscriptionBilling billing = SubscriptionBilling(vm.envAddress("BILLING"));
        uint128 price = uint128(vm.envUint("PRICE"));

        vm.startBroadcast();
        billing.createPlan(price, "plan");
        vm.stopBroadcast();
    }
}
