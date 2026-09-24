// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {SubscriptionBilling} from "../src/SubscriptionBilling.sol";
import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";

/// @notice Deploys the billing contract and seeds the two launch plans.
///
/// Usage (Base Sepolia dry run):
///   forge script script/Deploy.s.sol:Deploy --rpc-url base_sepolia
/// Usage (broadcast + verify):
///   forge script script/Deploy.s.sol:Deploy --rpc-url base --broadcast --verify
///
/// Env:
///   OWNER           operator address (a multisig, ideally) — defaults to the sender
///   USDC            override the built-in per-chain USDC address
contract Deploy is Script {
    // Circle's native USDC deployments.
    address constant USDC_BASE = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    address constant USDC_BASE_SEPOLIA = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;
    address constant USDC_MAINNET = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;
    address constant USDC_ARBITRUM = 0xaf88d065e77c8cC2239327C5EDb3A432268e5831;
    address constant USDC_OPTIMISM = 0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85;

    function run() external returns (SubscriptionBilling billing) {
        address usdc = vm.envOr("USDC", _usdcFor(block.chainid));
        require(usdc != address(0), "no USDC address for this chain; set USDC=0x...");
        require(usdc.code.length > 0, "USDC address has no code on this chain");

        address owner = vm.envOr("OWNER", msg.sender);

        vm.startBroadcast();
        billing = new SubscriptionBilling(IERC20(usdc), owner);

        // Seeded here so a fresh deployment is immediately usable. Prices are
        // immutable once set — to change one later, add a plan and close the old.
        if (owner == msg.sender) {
            billing.addPlan("hobby", 5e6); // $5 / 30 days
            billing.addPlan("pro", 20e6); // $20 / 30 days
        }
        vm.stopBroadcast();

        console.log("SubscriptionBilling:", address(billing));
        console.log("token (USDC):       ", usdc);
        console.log("owner:              ", owner);
        if (owner != msg.sender) {
            console.log("NOTE: owner is not the deployer, so no plans were seeded.");
            console.log(
                "      Have the owner call addPlan(\"hobby\", 5000000) and addPlan(\"pro\", 20000000)."
            );
        }
    }

    function _usdcFor(uint256 chainId) internal pure returns (address) {
        if (chainId == 8453) return USDC_BASE;
        if (chainId == 84_532) return USDC_BASE_SEPOLIA;
        if (chainId == 1) return USDC_MAINNET;
        if (chainId == 42_161) return USDC_ARBITRUM;
        if (chainId == 10) return USDC_OPTIMISM;
        return address(0);
    }
}
