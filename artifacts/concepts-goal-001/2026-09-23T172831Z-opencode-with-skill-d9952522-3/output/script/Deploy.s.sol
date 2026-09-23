// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {SubscriptionBilling, IERC20} from "../src/SubscriptionBilling.sol";

/// @notice Deploys SubscriptionBilling against the USDC address for the target chain
///         and creates the two launch plans: $5/month hobby, $20/month pro.
///
/// Usage:
///   USDC=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \  # USDC on Base
///   OWNER=0xYourOpsAddress \
///   forge script script/Deploy.s.sol --rpc-url base --broadcast --verify
///
/// Well-known USDC addresses (verify before deploying, they can change):
///   Base mainnet:    0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
///   Ethereum mainnet: 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48
///   Sepolia (test):  0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238
contract Deploy is Script {
    uint128 constant HOBBY_MONTHLY = 5e6; // 5 USDC (6 decimals) per 30 days
    uint128 constant PRO_MONTHLY = 20e6; // 20 USDC per 30 days

    function run() external {
        address usdc = vm.envAddress("USDC");
        address owner = vm.envOr("OWNER", msg.sender);

        vm.startBroadcast();
        SubscriptionBilling billing = new SubscriptionBilling(IERC20(usdc), owner);
        uint256 hobbyId = billing.createPlan(HOBBY_MONTHLY);
        uint256 proId = billing.createPlan(PRO_MONTHLY);
        vm.stopBroadcast();

        console.log("SubscriptionBilling:", address(billing));
        console.log("USDC:               ", usdc);
        console.log("Owner:              ", owner);
        console.log("Hobby plan id:      ", hobbyId);
        console.log("Pro plan id:        ", proId);
    }
}
