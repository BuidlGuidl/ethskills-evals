// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {SubscriptionBilling} from "../src/SubscriptionBilling.sol";

/// @notice Day-to-day operations. None of these are required for the system to bill correctly —
/// accrual happens whether or not anyone runs them. They exist to move earned revenue out.
contract Sweep is Script {
    /// @dev Settle a list of accounts, then sweep everything to the treasury.
    ///   SUBSCRIBERS=0xabc,0xdef forge script script/Ops.s.sol:Sweep --rpc-url base --broadcast
    function run() external {
        SubscriptionBilling billing = SubscriptionBilling(vm.envAddress("BILLING_ADDRESS"));
        address[] memory users = vm.envAddress("SUBSCRIBERS", ",");

        uint256 claimable = billing.collected();
        for (uint256 i = 0; i < users.length; i++) {
            claimable += billing.pending(users[i]);
        }
        console2.log("accounts:", users.length);
        console2.log("claimable (USDC units):", claimable);

        vm.startBroadcast();
        billing.settleMany(users);
        billing.sweep();
        vm.stopBroadcast();
    }
}

/// @notice Add a new price point. Existing subscribers are unaffected and keep their old price.
contract AddPlan is Script {
    function run() external {
        SubscriptionBilling billing = SubscriptionBilling(vm.envAddress("BILLING_ADDRESS"));
        uint128 price = uint128(vm.envUint("PLAN_PRICE"));

        vm.startBroadcast();
        uint256 id = billing.addPlan(price);
        vm.stopBroadcast();

        console2.log("added plan", id, "at price", price);
    }
}

/// @notice Stop new signups on a plan without touching anyone already on it.
contract ClosePlan is Script {
    function run() external {
        SubscriptionBilling billing = SubscriptionBilling(vm.envAddress("BILLING_ADDRESS"));
        uint256 id = vm.envUint("PLAN_ID");

        vm.startBroadcast();
        billing.setPlanOpen(id, false);
        vm.stopBroadcast();
    }
}
