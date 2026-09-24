// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {SubscriptionBilling} from "../src/SubscriptionBilling.sol";

/**
 * @notice Settles a batch of accounts and sweeps revenue to the payout address.
 *
 * This is the "get paid" job. It is permissionless -- it does not need the owner
 * key, just any funded EOA. Nothing breaks if it does not run; revenue simply
 * accrues in the contract until it does.
 *
 *   ACCOUNTS=0xabc...,0xdef... forge script script/Settle.s.sol --rpc-url base --broadcast
 */
contract Settle is Script {
    function run() external {
        SubscriptionBilling billing = SubscriptionBilling(vm.envAddress("BILLING_ADDRESS"));
        address[] memory accounts = vm.envAddress("ACCOUNTS", ",");

        vm.startBroadcast();
        billing.settleMany(accounts);

        uint256 revenue = billing.withdrawableRevenue();
        if (revenue > 0) {
            billing.withdrawRevenue(revenue);
            console2.log("swept to payout:", revenue);
        } else {
            console2.log("nothing earned yet");
        }
        vm.stopBroadcast();
    }
}
