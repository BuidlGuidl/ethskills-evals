// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {SubscriptionBilling} from "../src/SubscriptionBilling.sol";

/// @notice The two routine operator jobs, as scripts.
///
///   BILLING=0x... ACCOUNTS=0xaaa,0xbbb \
///     forge script script/Ops.s.sol:Settle --rpc-url base --broadcast
///
///   BILLING=0x... TO=0x... AMOUNT=5000000 \
///     forge script script/Ops.s.sol:WithdrawRevenue --rpc-url base --broadcast
///
/// Settling is permissionless — anyone can run it, including the customers
/// themselves. It does not need the owner key.
contract Settle is Script {
    function run() external {
        SubscriptionBilling billing = SubscriptionBilling(vm.envAddress("BILLING"));
        address[] memory accounts = vm.envAddress("ACCOUNTS", ",");

        uint256 before = billing.collectedRevenue();
        vm.broadcast();
        billing.settleMany(accounts);

        console.log("accounts settled:", accounts.length);
        console.log("revenue moved:   ", billing.collectedRevenue() - before);
        console.log("withdrawable now:", billing.collectedRevenue());
    }
}

contract WithdrawRevenue is Script {
    function run() external {
        SubscriptionBilling billing = SubscriptionBilling(vm.envAddress("BILLING"));
        address to = vm.envAddress("TO");
        uint256 amount = vm.envOr("AMOUNT", billing.collectedRevenue());

        require(amount > 0, "nothing settled to withdraw; run Settle first");

        vm.broadcast();
        billing.withdrawRevenue(to, amount);

        console.log("withdrew:  ", amount);
        console.log("to:        ", to);
        console.log("remaining: ", billing.collectedRevenue());
    }
}

contract AddPlan is Script {
    function run() external {
        SubscriptionBilling billing = SubscriptionBilling(vm.envAddress("BILLING"));
        string memory name = vm.envString("PLAN_NAME");
        uint96 price = uint96(vm.envUint("PLAN_PRICE"));

        vm.broadcast();
        uint32 planId = billing.addPlan(name, price);

        console.log("plan id:", planId);
        console.log("name:   ", name);
        console.log("price:  ", price);
    }
}
