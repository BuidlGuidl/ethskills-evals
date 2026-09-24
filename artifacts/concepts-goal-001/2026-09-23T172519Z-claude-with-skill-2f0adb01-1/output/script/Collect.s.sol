// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Vm, VM_ADDRESS} from "./Vm.sol";
import {SubscriptionBilling} from "../src/SubscriptionBilling.sol";

/// @notice Sweeps settled revenue to the treasury.
///
/// Note what this does NOT do: it does not "run billing". Billing accrues on its own
/// as a function of time; this only relabels already-consumed funds as revenue and
/// moves them out. Skipping a month costs you nothing but the delay.
///
///   export BILLING=0x...  TREASURY=0x...
///   forge script script/Collect.s.sol --rpc-url $RPC_URL --broadcast
contract Collect {
    Vm internal constant vm = Vm(VM_ADDRESS);

    function run() external {
        SubscriptionBilling billing = SubscriptionBilling(vm.envAddress("BILLING"));
        address treasury = vm.envAddress("TREASURY");

        uint256 amount = billing.revenueAccrued();
        require(amount > 0, "Collect: nothing settled yet - run collectMany first");

        vm.startBroadcast();
        billing.withdrawRevenue(treasury, amount);
        vm.stopBroadcast();
    }
}
