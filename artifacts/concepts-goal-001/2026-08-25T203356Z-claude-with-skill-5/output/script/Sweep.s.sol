// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {SubscriptionBilling} from "../src/SubscriptionBilling.sol";

/// @notice Settle a batch of accounts and pull the revenue to the treasury.
///
/// @dev This is a convenience for the operator's own bookkeeping, not a load-bearing
///      part of the design: revenue accrues whether or not this ever runs, and
///      `withdrawable()` is always net of it, so skipping a month costs nothing. Run it
///      when you want the cash, not on a schedule you have to keep.
///
///      Env:
///        BILLING  — the deployed contract
///        ACCOUNTS — comma-separated addresses to settle (from AccountUpdated logs)
///
///      Usage:
///        forge script script/Sweep.s.sol --rpc-url $RPC --broadcast
contract Sweep is Script {
    function run() external {
        SubscriptionBilling billing = SubscriptionBilling(vm.envAddress("BILLING"));
        address[] memory accounts = vm.envOr("ACCOUNTS", ",", new address[](0));

        uint256 projected = billing.revenueIncluding(accounts);
        console2.log("accounts to settle:", accounts.length);
        console2.log("revenue after sweep:", projected);
        if (projected == 0) {
            console2.log("nothing to collect");
            return;
        }

        vm.startBroadcast();
        if (accounts.length > 0) billing.settleMany(accounts);
        billing.withdrawRevenue();
        vm.stopBroadcast();

        console2.log("swept to treasury:", billing.treasury());
    }
}
