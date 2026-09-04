// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SubscriptionBilling} from "../src/SubscriptionBilling.sol";
import {MockUSDC} from "../test/mocks/MockUSDC.sol";

/// @notice Local-only: stands the whole thing up on anvil with a fake USDC, so the backend gate
///         can be exercised against a real chain. Never point this at a public network.
///
///   anvil &
///   forge script script/LocalDev.s.sol --rpc-url http://127.0.0.1:8545 --broadcast \
///     --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
///
/// Writes deployments/local.json for backend/e2e.mjs to pick up.
contract LocalDev is Script {
    function run() external {
        require(block.chainid == 31337, "LocalDev is for anvil only");

        // anvil account #1 plays the customer
        address customer = 0x70997970C51812dc3A010C7d01b50e0d17dc79C8;

        vm.startBroadcast();
        MockUSDC usdc = new MockUSDC();
        SubscriptionBilling billing = new SubscriptionBilling(IERC20(address(usdc)), msg.sender);
        uint256 hobby = billing.createPlan(5e6);
        uint256 pro = billing.createPlan(20e6);
        usdc.mint(customer, 1000e6);
        vm.stopBroadcast();

        string memory out = "local";
        vm.serializeAddress(out, "billing", address(billing));
        vm.serializeAddress(out, "usdc", address(usdc));
        vm.serializeUint(out, "hobbyPlanId", hobby);
        string memory json = vm.serializeUint(out, "proPlanId", pro);
        vm.writeJson(json, "./deployments/local.json");

        console.log("billing ", address(billing));
        console.log("usdc    ", address(usdc));
        console.log("customer", customer);
    }
}
