// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {WeatherBilling} from "../src/WeatherBilling.sol";
import {MockUSDC} from "../test/MockUSDC.sol";

/// @notice End-to-end demo against a local anvil node. Deploys a mock USDC and
///         the billing contract, then tops up and subscribes the broadcaster.
///
///   anvil &
///   forge script script/LocalDemo.s.sol --rpc-url http://127.0.0.1:8545 \
///     --broadcast --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
///   node tools/check-subscribed.mjs 0xf39Fd6e3aadF8245fC8d4E4C1A0eE3DcB1eB8f5f \
///     --billing <printed address> --rpc http://127.0.0.1:8545
contract LocalDemo is Script {
    function run() external {
        vm.startBroadcast();
        MockUSDC usdc = new MockUSDC();
        WeatherBilling billing = new WeatherBilling(usdc, msg.sender, 5e6, 20e6);

        usdc.mint(msg.sender, 50e6);
        usdc.approve(address(billing), type(uint256).max);
        billing.topUp(15e6);
        billing.subscribe(WeatherBilling.Plan.Hobby);
        vm.stopBroadcast();

        console2.log("BILLING_ADDRESS=%s", address(billing));
        console2.log("USDC_ADDRESS=%s", address(usdc));
        console2.log("CUSTOMER_ADDRESS=%s", msg.sender);
        console2.log("TREASURY_ADDRESS=%s", msg.sender);
        console2.log("isSubscribed (from the contract): %s", billing.isSubscribed(msg.sender));
        (, uint256 paidUntil, uint256 credit,) = billing.getAccount(msg.sender);
        console2.log("paidUntil:", paidUntil);
        console2.log("credit (USDC units):", credit);
    }
}
