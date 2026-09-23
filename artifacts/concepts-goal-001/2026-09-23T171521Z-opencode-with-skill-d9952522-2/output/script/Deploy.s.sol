// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {WeatherBilling} from "../src/WeatherBilling.sol";

/// @notice Deploys WeatherBilling with the two plans: $5 hobby / $20 pro.
///
/// Usage (Foundry):
///   # mainnet USDC by default; override for another chain's USDC
///   export USDC_ADDRESS=0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48
///   export OWNER_ADDRESS=0xYourTreasuryOrMultisig
///   forge script script/Deploy.s.sol --rpc-url $RPC_URL --broadcast --verify
///
/// OWNER_ADDRESS should be a multisig or a hardware wallet you control:
/// it sets prices and collects revenue. There is nothing else for it to
/// do — no pause key, no upgrade key — and losing it does not stop
/// billing: existing subscriptions keep running and customers keep
/// their credit and refund rights; only price changes and revenue
/// collection would stall until you recover the key.
contract Deploy is Script {
    // $5 and $20 in 6-decimal USDC base units. If your chain's "USDC"
    // uses different decimals, export adjusted prices or edit here.
    uint256 constant HOBBY_PRICE = 5e6;
    uint256 constant PRO_PRICE = 20e6;

    // Circle's USDC on Ethereum mainnet (proxy address, stable since 2018).
    // Always verify against https://circle.com/... before deploying with
    // real money, and override for any other chain or token.
    address constant MAINNET_USDC = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;

    function run() external returns (WeatherBilling billing) {
        address usdcAddress = vm.envOr("USDC_ADDRESS", MAINNET_USDC);
        address owner = vm.envAddress("OWNER_ADDRESS");
        uint256 hobby = vm.envOr("HOBBY_PRICE", HOBBY_PRICE);
        uint256 pro = vm.envOr("PRO_PRICE", PRO_PRICE);

        uint256[] memory prices = new uint256[](2);
        prices[0] = hobby;
        prices[1] = pro;

        vm.startBroadcast();
        billing = new WeatherBilling(usdcAddress, owner, prices);
        vm.stopBroadcast();

        console.log("WeatherBilling deployed at:", address(billing));
        console.log("USDC:", usdcAddress);
        console.log("Owner (prices + revenue):", owner);
        console.log("Plan 0 (hobby):", hobby, "base units");
        console.log("Plan 1 (pro):", pro, "base units");
    }
}