// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {SubscriptionBilling} from "../src/SubscriptionBilling.sol";
import {IERC20} from "../src/interfaces/IERC20.sol";

/// @notice Deploys SubscriptionBilling with the $5 hobby / $20 pro plans.
///
/// @dev Env:
///        TREASURY  — required, address that receives streamed revenue
///        USDC      — optional, overrides the per-chain default below
///
///      Usage:
///        forge script script/Deploy.s.sol --rpc-url $RPC --broadcast --verify
contract Deploy is Script {
    /// @dev Circle's canonical (native, not bridged) USDC. Re-check against
    ///      https://developers.circle.com/stablecoins/usdc-contract-addresses before a
    ///      mainnet deploy — deploying against a bridged USDC.e by mistake is the kind
    ///      of thing you only notice once customers have deposited into it.
    function usdcFor(uint256 chainId) public pure returns (address) {
        if (chainId == 1) return 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48; // Ethereum
        if (chainId == 8453) return 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913; // Base
        if (chainId == 10) return 0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85; // Optimism
        if (chainId == 42161) return 0xaf88d065e77c8cC2239327C5EDb3A432268e5831; // Arbitrum
        if (chainId == 84532) return 0x036CbD53842c5426634e7929541eC2318f3dCF7e; // Base Sepolia
        if (chainId == 11155420) return 0x5fd84259d66Cd46123540766Be93DFE6D43130D7; // OP Sepolia
        if (chainId == 421614) return 0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d; // Arb Sepolia
        return address(0);
    }

    function run() external returns (SubscriptionBilling billing) {
        address treasury = vm.envAddress("TREASURY");
        address usdc = vm.envOr("USDC", usdcFor(block.chainid));
        require(usdc != address(0), "no USDC for this chain; set USDC=0x...");

        // 6 decimals: $5.00 and $20.00 per 30-day month.
        uint128[] memory prices = new uint128[](2);
        prices[0] = 5_000_000;
        prices[1] = 20_000_000;

        vm.startBroadcast();
        billing = new SubscriptionBilling(IERC20(usdc), treasury, prices);
        vm.stopBroadcast();

        console2.log("SubscriptionBilling:", address(billing));
        console2.log("token:              ", usdc);
        console2.log("treasury:           ", treasury);
        console2.log("plan 1 (hobby):      5000000 per 30d");
        console2.log("plan 2 (pro):       20000000 per 30d");
    }
}
