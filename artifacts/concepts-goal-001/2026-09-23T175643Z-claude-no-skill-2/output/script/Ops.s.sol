// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {SubscriptionBilling} from "../src/SubscriptionBilling.sol";
import {ISubscriptionBilling} from "../src/interfaces/ISubscriptionBilling.sol";

/// @dev Shared plumbing: read the deployed address from deployments/<chainId>.json, or BILLING.
abstract contract OpsScript is Script {
    function _billing() internal view returns (SubscriptionBilling) {
        address a = vm.envOr("BILLING", address(0));
        if (a == address(0)) {
            string memory json =
                vm.readFile(string.concat("deployments/", vm.toString(block.chainid), ".json"));
            a = vm.parseJsonAddress(json, ".subscriptionBilling");
        }
        return SubscriptionBilling(a);
    }
}

/// @notice Sweep accrued revenue for a batch of subscribers into `earned`.
/// @dev `SUBSCRIBERS=0xaaa,0xbbb forge script script/Ops.s.sol:Settle --broadcast --rpc-url $RPC`
contract Settle is OpsScript {
    function run() external {
        SubscriptionBilling billing = _billing();
        address[] memory users = vm.envAddress("SUBSCRIBERS", ",");

        uint256 pending;
        for (uint256 i; i < users.length; ++i) {
            pending += billing.accruedOf(users[i]);
        }
        console2.log("settling %s accounts, %s USDC base units pending", users.length, pending);

        vm.broadcast();
        billing.settleMany(users);
    }
}

/// @notice Move settled revenue out to the treasury.
/// @dev `TO=0x... forge script script/Ops.s.sol:WithdrawEarnings --broadcast --rpc-url $RPC`
///      Omit AMOUNT to take everything available.
contract WithdrawEarnings is OpsScript {
    function run() external {
        SubscriptionBilling billing = _billing();
        address to = vm.envAddress("TO");
        uint256 amount = vm.envOr("AMOUNT", billing.earned());
        require(amount > 0, "nothing to withdraw; settle subscribers first");

        console2.log("withdrawing %s to %s", amount, to);
        vm.broadcast();
        billing.withdrawEarnings(to, amount);
    }
}

/// @notice Read-only health check. Safe to run against mainnet without a key.
/// @dev `SUBSCRIBERS=0xaaa,0xbbb forge script script/Ops.s.sol:Report --rpc-url $RPC`
contract Report is OpsScript {
    function run() external view {
        SubscriptionBilling billing = _billing();
        console2.log("billing contract:   ", address(billing));
        console2.log("owner:              ", billing.owner());
        console2.log("paused:             ", billing.paused());
        console2.log("customer balances:  ", billing.totalCustomerBalance());
        console2.log("settled revenue:    ", billing.earned());
        console2.log("stray tokens:       ", billing.surplus());

        address[] memory users = vm.envOr("SUBSCRIBERS", ",", new address[](0));
        for (uint256 i; i < users.length; ++i) {
            ISubscriptionBilling.Status memory s = billing.statusOf(users[i]);
            console2.log("---", users[i]);
            console2.log("  subscribed:", s.subscribed, "plan:", s.planId);
            console2.log("  expires at:", s.expiresAt);
            console2.log("  balance:", s.balance, "accrued:", s.accrued);
        }
    }
}
