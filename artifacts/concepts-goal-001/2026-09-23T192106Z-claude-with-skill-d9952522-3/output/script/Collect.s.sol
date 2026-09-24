// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {Subscriptions} from "../src/Subscriptions.sol";

/// @notice Settle a batch of accounts and sweep the revenue to the payout address.
///
///         This is the only recurring transaction in the system, and it is not a
///         deadline: consumed balance is already unspendable by the customer, so
///         settling late costs nothing and settling early gains nothing. Run it when
///         you actually want the money.
///
///         ACCOUNTS is a comma-separated list of addresses, e.g.
///         ACCOUNTS=0xabc...,0xdef...
contract Collect is Script {
    function run() external {
        Subscriptions sub = Subscriptions(vm.envAddress("SUBSCRIPTIONS"));
        address[] memory accounts = vm.envAddress("ACCOUNTS", ",");
        address payout = vm.envAddress("PAYOUT");

        console.log("pending before: %s", sub.pendingRevenue(accounts));

        vm.broadcast();
        sub.collect(accounts);

        uint256 available = sub.earned();
        console.log("settled revenue available: %s", available);
        if (available > 0) {
            vm.broadcast();
            sub.withdrawRevenue(payout, available);
            console.log("withdrawn to %s", payout);
        }
    }
}
