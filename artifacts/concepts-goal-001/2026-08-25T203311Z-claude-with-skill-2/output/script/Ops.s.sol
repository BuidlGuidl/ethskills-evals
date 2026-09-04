// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {SubscriptionBilling} from "../src/SubscriptionBilling.sol";

/// @notice Day-two operations. Every one of these is optional: skipping them forever changes no
///         balance and no access decision (see the design note on SubscriptionBilling). They exist
///         so you can move your own revenue and read the books, not to keep the system alive.
///
/// Read one account (no transaction, no key needed):
///   forge script script/Ops.s.sol --sig "status(address)" 0xCustomer --rpc-url base
///
/// Sweep revenue for a list of subscribers:
///   SUBSCRIBERS="0xa,0xb,0xc" forge script script/Ops.s.sol --sig "collect()" \
///     --rpc-url base --broadcast --account deployer
///
/// Retire a plan for new signups (existing subscribers keep their price):
///   forge script script/Ops.s.sol --sig "closePlan(uint256)" 1 \
///     --rpc-url base --broadcast --account deployer
///
/// Env:
///   BILLING_ADDRESS  deployed SubscriptionBilling
///   SUBSCRIBERS      comma-separated addresses, for settle()/collect()
///   PAYOUT_TO        where collect() sends revenue; defaults to the broadcasting address
contract Ops is Script {
    function _billing() internal view returns (SubscriptionBilling) {
        return SubscriptionBilling(vm.envAddress("BILLING_ADDRESS"));
    }

    /// @notice Print everything the contract knows about one subscriber.
    function status(address subscriber) external view {
        SubscriptionBilling billing = _billing();
        (uint256 planId, uint256 price, uint256 balance, uint256 unused, uint256 activeUntil, bool active) =
            billing.accountOf(subscriber);

        console.log("subscriber      ", subscriber);
        console.log("subscribed now  ", active);
        console.log("plan id         ", planId);
        console.log("price / 30 days ", price);
        console.log("prepaid balance ", balance);
        console.log("refund if cancel", unused);
        console.log("active until    ", activeUntil);
        if (active) {
            console.log("seconds left    ", activeUntil - block.timestamp);
        }
        console.log("unsettled usage ", billing.pendingCharge(subscriber));
    }

    /// @notice Print the contract-wide books. `operatorAccrued` is what you can withdraw right
    ///         now; unsettled usage across your subscribers is revenue you have earned but not
    ///         yet written down.
    function books() external view {
        SubscriptionBilling billing = _billing();
        console.log("billing token   ", address(billing.token()));
        console.log("owner           ", billing.owner());
        console.log("subscriber float", billing.totalUserBalance());
        console.log("withdrawable    ", billing.operatorAccrued());
        for (uint256 id = 1; id < billing.nextPlanId(); ++id) {
            (uint128 price, bool open) = billing.plans(id);
            console.log("plan %s: %s base units / 30 days, open: %s", id, price, open);
        }
    }

    /// @notice Book accrued usage as revenue for SUBSCRIBERS, without withdrawing. Permissionless.
    function settle() external {
        SubscriptionBilling billing = _billing();
        address[] memory subs = _subscribers();
        vm.startBroadcast();
        billing.settleMany(subs);
        vm.stopBroadcast();
        console.log("settled %s subscribers; withdrawable now %s", subs.length, billing.operatorAccrued());
    }

    /// @notice Settle SUBSCRIBERS and sweep all revenue to PAYOUT_TO. Owner only.
    function collect() external {
        SubscriptionBilling billing = _billing();
        address[] memory subs = _subscribers();
        vm.startBroadcast();
        address to = vm.envOr("PAYOUT_TO", msg.sender);
        uint256 swept = billing.collect(subs, to);
        vm.stopBroadcast();
        console.log("swept %s base units to %s", swept, to);
    }

    /// @notice Stop new signups on a plan. Existing subscribers are untouched: same price, same
    ///         balance, still able to top up and still able to cancel for a refund.
    function closePlan(uint256 planId) external {
        vm.startBroadcast();
        _billing().setPlanOpen(planId, false);
        vm.stopBroadcast();
        console.log("plan %s closed to new subscribers", planId);
    }

    /// @notice Publish a new price. Repricing is always a new plan — existing subscribers can
    ///         never be repriced under this contract, they have to opt in by switching.
    function createPlan(uint256 pricePerPeriod) external {
        vm.startBroadcast();
        uint256 id = _billing().createPlan(pricePerPeriod);
        vm.stopBroadcast();
        console.log("plan %s created at %s base units / 30 days", id, pricePerPeriod);
    }

    function _subscribers() internal view returns (address[] memory) {
        return vm.envAddress("SUBSCRIBERS", ",");
    }
}
