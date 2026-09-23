// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {SubscriptionBilling} from "../src/SubscriptionBilling.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @notice Deploys the billing contract and seeds the $5 / $20 plans.
 *
 * Plan ids are assigned in order, so after this script:
 *   planId 1 = hobby ($5/period), planId 2 = pro ($20/period)
 *
 * Usage (dry run):
 *   forge script script/Deploy.s.sol --rpc-url base_sepolia
 * Usage (broadcast + verify):
 *   forge script script/Deploy.s.sol --rpc-url base --broadcast --verify
 */
contract Deploy is Script {
    // Circle's canonical (native, not bridged) USDC.
    address internal constant USDC_BASE = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    address internal constant USDC_BASE_SEPOLIA = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;

    uint128 internal constant HOBBY_PRICE = 5e6; // $5.00, USDC has 6 decimals
    uint128 internal constant PRO_PRICE = 20e6; // $20.00

    function run() external returns (SubscriptionBilling billing) {
        address usdc = _usdcForChain();
        address deployer = msg.sender;

        // Owner administers plans; payout receives revenue. Default both to the
        // deployer, but OWNER should really be a multisig -- see NOTES.md.
        address owner = vm.envOr("OWNER", deployer);
        address payoutAddress = vm.envOr("PAYOUT_ADDRESS", deployer);

        console2.log("chain id        ", block.chainid);
        console2.log("usdc            ", usdc);
        console2.log("owner           ", owner);
        console2.log("payout          ", payoutAddress);

        vm.startBroadcast();
        billing = new SubscriptionBilling(IERC20(usdc), owner, payoutAddress);

        // addPlan is onlyOwner, so it can only be called here if the broadcaster is
        // the owner. With an external owner, run script/AddPlans.s.sol from it after.
        if (owner == deployer) {
            uint32 hobby = billing.addPlan(HOBBY_PRICE);
            uint32 pro = billing.addPlan(PRO_PRICE);
            console2.log("plan hobby id   ", hobby);
            console2.log("plan pro id     ", pro);
        } else {
            console2.log("owner is external - add plans from the owner account next");
        }
        vm.stopBroadcast();

        console2.log("SubscriptionBilling", address(billing));
        console2.log("period (seconds)   ", billing.PERIOD());
    }

    function _usdcForChain() internal view returns (address) {
        address override_ = vm.envOr("USDC_ADDRESS", address(0));
        if (override_ != address(0)) return override_;
        if (block.chainid == 8453) return USDC_BASE;
        if (block.chainid == 84532) return USDC_BASE_SEPOLIA;
        revert("set USDC_ADDRESS for this chain");
    }
}

/// @notice Adds the two standard plans. Must be run from the owner account.
contract AddPlans is Script {
    function run() external {
        SubscriptionBilling billing = SubscriptionBilling(vm.envAddress("BILLING_ADDRESS"));
        vm.startBroadcast();
        console2.log("hobby id", billing.addPlan(5e6));
        console2.log("pro id", billing.addPlan(20e6));
        vm.stopBroadcast();
    }
}
