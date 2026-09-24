// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {IERC20} from "openzeppelin-contracts/token/ERC20/IERC20.sol";

import {SubscriptionBilling} from "../src/SubscriptionBilling.sol";
import {ISubscriptionBilling} from "../src/ISubscriptionBilling.sol";
import {Addresses} from "./Addresses.sol";

/// @dev Resolves the deployed address from deployments/<chain>.json, or from
/// BILLING_ADDRESS if set.
abstract contract OpsBase is Script {
    function billing() internal view returns (SubscriptionBilling) {
        address addr = vm.envOr("BILLING_ADDRESS", address(0));
        if (addr == address(0)) {
            string memory path = string.concat("deployments/", Addresses.name(block.chainid), ".json");
            addr = vm.parseJsonAddress(vm.readFile(path), ".subscriptionBilling");
        }
        require(addr.code.length > 0, "no billing contract at resolved address");
        return SubscriptionBilling(addr);
    }

    function usdcUnits(uint256 amount) internal pure returns (string memory) {
        return string.concat(vm.toString(amount / 1e6), ".", _pad(amount % 1e6), " USDC");
    }

    function _pad(uint256 frac) private pure returns (string memory out) {
        out = vm.toString(frac);
        while (bytes(out).length < 6) {
            out = string.concat("0", out);
        }
    }
}

/// @notice Create or reprice a plan.
/// forge script script/Ops.s.sol:SetPlan --rpc-url base --broadcast \
///   --sig "run(uint8,uint128,bool)" 1 5000000 true
contract SetPlan is OpsBase {
    function run(uint8 planId, uint128 price, bool active) external {
        vm.startBroadcast();
        billing().setPlan(planId, price, active);
        vm.stopBroadcast();
        console2.log("plan", planId, "=", usdcUnits(price));
        console2.log("open to new sign-ups:", active);
    }
}

/// @notice Settle a batch of accounts so their elapsed periods become
/// withdrawable revenue. Safe for anyone to run; it only realises what is
/// already owed. Feed it the subscriber list your indexer keeps.
/// forge script script/Ops.s.sol:Settle --rpc-url base --broadcast \
///   --sig "run(address[])" "[0xabc...,0xdef...]"
contract Settle is OpsBase {
    function run(address[] calldata accounts) external {
        SubscriptionBilling b = billing();
        uint256 before = b.merchantAccrued();
        vm.startBroadcast();
        b.settleMany(accounts);
        vm.stopBroadcast();
        console2.log("accounts settled:", accounts.length);
        console2.log("newly booked:", usdcUnits(b.merchantAccrued() - before));
    }
}

/// @notice Move earned revenue to the payout address.
/// forge script script/Ops.s.sol:Withdraw --rpc-url base --broadcast \
///   --sig "run(address,uint256)" 0xpayout 0
/// Passing 0 withdraws everything currently booked.
contract Withdraw is OpsBase {
    function run(address to, uint256 amount) external {
        SubscriptionBilling b = billing();
        if (amount == 0) amount = b.merchantAccrued();
        require(amount > 0, "nothing booked; run Settle first");
        vm.startBroadcast();
        b.withdrawRevenue(to, amount);
        vm.stopBroadcast();
        console2.log("withdrew", usdcUnits(amount));
    }
}

/// @notice Stop new deposits and sign-ups. Cancellations and withdrawals stay
/// open, by design, so this is not a freeze on customer funds.
/// forge script script/Ops.s.sol:SetPaused --rpc-url base --broadcast \
///   --sig "run(bool)" true
contract SetPaused is OpsBase {
    function run(bool paused) external {
        vm.startBroadcast();
        billing().setPaused(paused);
        vm.stopBroadcast();
        console2.log("paused:", paused);
    }
}

/// @notice Read-only health check. No broadcast, no key needed.
/// forge script script/Ops.s.sol:Health --rpc-url base --sig "run(address[])" "[]"
contract Health is OpsBase {
    function run(address[] calldata watch) external view {
        SubscriptionBilling b = billing();
        IERC20 token = b.usdc();

        uint256 held = token.balanceOf(address(b));
        uint256 owed = b.totalUserFunds();
        uint256 booked = b.merchantAccrued();

        console2.log("contract      ", address(b));
        console2.log("paused        ", b.paused());
        console2.log("owner         ", b.owner());
        console2.log("USDC held     ", usdcUnits(held));
        console2.log("owed to users ", usdcUnits(owed));
        console2.log("booked revenue", usdcUnits(booked));
        console2.log("unclaimed     ", usdcUnits(b.accruedIncluding(watch) - booked));

        require(held >= owed + booked, "INSOLVENT: contract holds less than it owes");
        console2.log("surplus       ", usdcUnits(held - owed - booked));

        for (uint256 i; i < watch.length; ++i) {
            ISubscriptionBilling.Status memory st = b.statusOf(watch[i]);
            console2.log("--", watch[i]);
            console2.log("   active", st.active, "plan", st.plan);
            console2.log("   credit", usdcUnits(st.credit));
            console2.log("   expires at", st.expiresAt);
        }
    }
}
