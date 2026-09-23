// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {SubscriptionBilling} from "../src/SubscriptionBilling.sol";

/// @notice Accept a pending ownership transfer. Run from the BILLING_OWNER signer.
///   BILLING_CONTRACT=0x... forge script script/Ops.s.sol --tc AcceptOwnership --rpc-url base --broadcast
contract AcceptOwnership is Script {
    function run() external {
        SubscriptionBilling billing = SubscriptionBilling(vm.envAddress("BILLING_CONTRACT"));
        vm.startBroadcast();
        billing.acceptOwnership();
        vm.stopBroadcast();
        console2.log("owner is now:", billing.owner());
    }
}

/// @notice Change a plan price, or retire a plan. Existing subscribers are unaffected
/// either way; see setPlan's docs.
///   BILLING_CONTRACT=0x... PLAN_ID=1 PLAN_PRICE=7000000 PLAN_OPEN=true \
///     forge script script/Ops.s.sol --tc SetPlan --rpc-url base --broadcast
contract SetPlan is Script {
    function run() external {
        SubscriptionBilling billing = SubscriptionBilling(vm.envAddress("BILLING_CONTRACT"));
        uint16 planId = uint16(vm.envUint("PLAN_ID"));
        uint128 price = uint128(vm.envUint("PLAN_PRICE"));
        bool open = vm.envBool("PLAN_OPEN");

        vm.startBroadcast();
        billing.setPlan(planId, price, open);
        vm.stopBroadcast();

        console2.log("plan", planId, "price", price);
        console2.log("open:", open);
    }
}
