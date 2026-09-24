// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {SubscriptionBilling} from "../src/SubscriptionBilling.sol";

/// @notice Day-to-day operations against a live deployment. Each entrypoint reads BILLING
///         (the contract address) from the environment.
///
///   forge script script/Ops.s.sol --sig 'settle(address[])' '[0xabc...]' --rpc-url base --broadcast
///   forge script script/Ops.s.sol --sig 'collect(address)' 0xpayout --rpc-url base --broadcast
///   forge script script/Ops.s.sol --sig 'setPrice(uint8,uint256)' 1 6000000 --rpc-url base --broadcast
///   forge script script/Ops.s.sol --sig 'report(address[])' '[0xabc...]' --rpc-url base
contract Ops is Script {
    function _billing() internal view returns (SubscriptionBilling) {
        return SubscriptionBilling(vm.envAddress("BILLING"));
    }

    /// @notice Book elapsed periods as revenue for the given accounts. Permissionless.
    function settle(address[] calldata accounts) external {
        SubscriptionBilling billing = _billing();
        uint256 before = billing.accruedRevenue();
        vm.broadcast();
        billing.settleMany(accounts);
        console2.log("newly booked revenue:", billing.accruedRevenue() - before);
    }

    /// @notice Sweep all settled revenue to a payout address.
    function collect(address to) external {
        SubscriptionBilling billing = _billing();
        uint256 amount = billing.accruedRevenue();
        require(amount > 0, "nothing to collect");
        vm.broadcast();
        billing.withdrawRevenue(to, amount);
        console2.log("collected:", amount);
    }

    /// @notice Settle everyone listed, then sweep. The usual monthly chore, in one tx pair.
    function settleAndCollect(address[] calldata accounts, address to) external {
        SubscriptionBilling billing = _billing();
        vm.broadcast();
        billing.settleMany(accounts);
        uint256 amount = billing.accruedRevenue();
        require(amount > 0, "nothing to collect");
        vm.broadcast();
        billing.withdrawRevenue(to, amount);
        console2.log("collected:", amount);
    }

    /// @notice Change a plan price for future subscribers. Existing subscribers are unaffected.
    function setPrice(uint8 planId, uint256 price) external {
        vm.broadcast();
        _billing().setPlanPrice(planId, price);
    }

    /// @notice Stop new deposits and signups without touching anyone's ability to leave.
    function pauseSignups(bool paused) external {
        vm.broadcast();
        _billing().setSignupsPaused(paused);
    }

    /// @notice Read-only health check: what is owed, what is claimable, and is it all backed.
    function report(address[] calldata accounts) external view {
        SubscriptionBilling billing = _billing();
        uint256 settled = billing.accruedRevenue();
        uint256 claimable = billing.previewRevenue(accounts);
        console2.log("customer funds held: ", billing.customerFunds());
        console2.log("revenue settled:     ", settled);
        console2.log("revenue claimable:   ", claimable, "(after settling the listed accounts)");
        console2.log("signups paused:      ", billing.signupsPaused());

        uint256 active;
        for (uint256 i; i < accounts.length; i++) {
            if (billing.isSubscribed(accounts[i])) active++;
        }
        console2.log("active of listed:    ", active, "/", accounts.length);
    }
}
