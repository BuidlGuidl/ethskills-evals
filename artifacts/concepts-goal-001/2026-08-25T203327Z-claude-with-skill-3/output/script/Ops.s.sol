// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {SubscriptionBilling} from "../src/SubscriptionBilling.sol";

abstract contract OpsBase is Script {
    function _billing() internal view returns (SubscriptionBilling) {
        return SubscriptionBilling(vm.envAddress("BILLING_ADDRESS"));
    }

    /// @dev USDC has 6 decimals; print dollars and cents.
    function _usd(uint256 units) internal pure returns (string memory) {
        uint256 cents = (units % 1e6) / 1e4;
        return string.concat("$", vm.toString(units / 1e6), ".", cents < 10 ? "0" : "", vm.toString(cents));
    }
}

/// @notice Read-only health check. Run it whenever you want to know where the money is.
///   forge script script/Ops.s.sol:Status --rpc-url base
contract Status is OpsBase {
    function run() external view {
        SubscriptionBilling billing = _billing();
        uint256 n = billing.subscriberCount();

        console2.log("subscribers          :", n);
        console2.log("booked revenue       :", _usd(billing.accruedRevenue()));
        console2.log("incl. unsettled      :", _usd(billing.claimableRevenue()));
        console2.log("customer float held  :", _usd(billing.totalPrepaid()));

        uint256 lapsed;
        for (uint256 i = 0; i < n; i += 200) {
            address[] memory page = billing.subscribers(i, 200);
            for (uint256 j = 0; j < page.length; j++) {
                if (!billing.isSubscribed(page[j])) lapsed++;
            }
        }
        console2.log("holding a plan but out of funds:", lapsed);
    }
}

/// @notice The only recurring transaction this system has: book consumed time as revenue, then
///         take it. Nothing else needs a keeper — accrual happens on its own between calls, so
///         running this late costs nothing but running it never means never getting paid.
///   forge script script/Ops.s.sol:Collect --rpc-url base --broadcast --account ops
contract Collect is OpsBase {
    uint256 internal constant BATCH = 100;

    function run() external {
        SubscriptionBilling billing = _billing();
        uint256 n = billing.subscriberCount();
        address payoutTo = vm.envOr("PAYOUT_ADDRESS", billing.owner());

        vm.startBroadcast();
        for (uint256 i = 0; i < n; i += BATCH) {
            billing.settleMany(billing.subscribers(i, BATCH));
        }
        uint256 amount = billing.accruedRevenue();
        if (amount > 0) billing.withdrawRevenue(payoutTo, amount);
        vm.stopBroadcast();

        console2.log("settled subscribers:", n);
        console2.log("withdrawn          :", _usd(amount));
        console2.log("to                 :", payoutTo);
    }
}

/// @notice Change pricing without re-rating anyone who already paid: open a new plan, close the
///         old one. Existing subscribers keep the price they signed up at until they switch.
///   NEW_PRICE=8000000 CLOSE_PLAN_ID=1 forge script script/Ops.s.sol:Reprice --rpc-url base --broadcast
contract Reprice is OpsBase {
    function run() external {
        SubscriptionBilling billing = _billing();
        uint128 newPrice = uint128(vm.envUint("NEW_PRICE"));
        uint32 closeId = uint32(vm.envUint("CLOSE_PLAN_ID"));

        vm.startBroadcast();
        uint32 newId = billing.createPlan(newPrice, true);
        billing.setPlanOpen(closeId, false);
        vm.stopBroadcast();

        console2.log("new plan id:", newId, _usd(newPrice));
        console2.log("closed plan:", closeId);
    }
}
