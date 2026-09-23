// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {SubscriptionBilling} from "../src/SubscriptionBilling.sol";

/// @notice Deploys SubscriptionBilling against the chain's real USDC.
///
///   USDC_ADDRESS=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \  # USDC on Base
///   forge script script/Deploy.s.sol --rpc-url base --broadcast --verify
///
/// Well-known native USDC addresses:
///   Ethereum  0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48
///   Base      0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
///   Arbitrum  0xaf88d065e77c8cC2239327C5EDb3A432268e5831
///   Optimism  0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85
///   Polygon   0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359
contract Deploy is Script {
    function run() external {
        address usdc = vm.envAddress("USDC_ADDRESS");
        vm.startBroadcast();
        SubscriptionBilling billing = new SubscriptionBilling(usdc);
        vm.stopBroadcast();
        console2.log("SubscriptionBilling:", address(billing));
        console2.log("USDC:", usdc);
        console2.log("Owner:", billing.owner());
    }
}
