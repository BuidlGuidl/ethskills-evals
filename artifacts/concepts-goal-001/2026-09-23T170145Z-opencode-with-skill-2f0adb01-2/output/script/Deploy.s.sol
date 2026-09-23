// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {SubscriptionBilling} from "../src/SubscriptionBilling.sol";

/// @notice Deploys SubscriptionBilling against the chain's real USDC.
///
///   source .env
///   forge script script/Deploy.s.sol --rpc-url $RPC_URL --broadcast --verify
///
/// USDC addresses (canonical, 6 decimals):
///   Ethereum mainnet: 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48
///   Base:             0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
///   Arbitrum One:     0xaf88d065e77c8cC2239327C5EDb3A432268e5831
///   Optimism:         0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85
///   Sepolia (test):   0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238
contract Deploy is Script {
    function run() external {
        address usdc = vm.envAddress("USDC_ADDRESS");
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerKey);
        SubscriptionBilling billing = new SubscriptionBilling(usdc);
        vm.stopBroadcast();

        console2.log("SubscriptionBilling deployed at:", address(billing));
        console2.log("USDC:", usdc);
        console2.log("Owner (fee recipient):", vm.addr(deployerKey));
    }
}
