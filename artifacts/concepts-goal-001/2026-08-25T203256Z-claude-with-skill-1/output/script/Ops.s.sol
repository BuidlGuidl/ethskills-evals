// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {SubscriptionBilling} from "../src/SubscriptionBilling.sol";
import {IERC20} from "../src/IERC20.sol";

/// @notice The two things the operator ever does after launch. See NOTES.md.
contract Ops is Script {
    function _billing() internal view returns (SubscriptionBilling) {
        return SubscriptionBilling(vm.envAddress("BILLING_ADDRESS"));
    }

    /// @notice Book elapsed time for a list of customers and sweep the proceeds, in one tx.
    ///
    ///   SUBSCRIBERS=0xabc...,0xdef... forge script script/Ops.s.sol --sig "collect()" \
    ///     --rpc-url base --broadcast
    ///
    /// @dev There is no deadline on this. Skipping a month costs nothing; see NOTES.md.
    function collect() external {
        SubscriptionBilling billing = _billing();
        address[] memory who = vm.envAddress("SUBSCRIBERS", ",");
        address to = vm.envOr("PAYOUT_TO", vm.envAddress("BILLING_OWNER"));

        console2.log("settling accounts:", who.length);
        vm.startBroadcast(vm.envUint("PRIVATE_KEY"));
        uint256 collected = billing.settleAndCollect(who, to);
        vm.stopBroadcast();
        console2.log("collected (token units):", collected);
        console2.log("paid to:", to);
    }

    /// @notice Reprice or close a plan. Only affects people who subscribe AFTER this lands.
    ///
    ///   PLAN_ID=1 PLAN_PRICE=7000000 PLAN_OPEN=true forge script script/Ops.s.sol \
    ///     --sig "setPlan()" --rpc-url base --broadcast
    function setPlan() external {
        SubscriptionBilling billing = _billing();
        uint8 id = uint8(vm.envUint("PLAN_ID"));
        uint128 price = uint128(vm.envUint("PLAN_PRICE"));
        bool open = vm.envOr("PLAN_OPEN", true);

        vm.startBroadcast(vm.envUint("PRIVATE_KEY"));
        billing.setPlan(id, price, open);
        vm.stopBroadcast();
        console2.log("plan", id, "price", price);
        console2.log("open:", open);
    }

    /// @notice Read-only health check. Run it from cron; alert if `unaccounted` is not ~0.
    ///
    ///   forge script script/Ops.s.sol --sig "status()" --rpc-url base
    function status() external view {
        SubscriptionBilling billing = _billing();
        IERC20 token = billing.token();
        uint256 held = token.balanceOf(address(billing));
        uint256 escrow = billing.totalEscrowed();
        uint256 rev = billing.revenue();

        console2.log("held in contract :", held);
        console2.log("customer escrow  :", escrow);
        console2.log("booked revenue   :", rev);
        console2.log("unaccounted      :", billing.unaccountedBalance());
        require(held >= escrow + rev, "INSOLVENT - contract holds less than it owes");
        console2.log("solvency         : ok");
    }
}
