// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SubscriptionBilling} from "../src/SubscriptionBilling.sol";
import {MockERC20} from "../test/mocks/MockERC20.sol";

/// @notice Stands up a fake USDC, the billing contract, and one funded subscriber on a local
/// anvil, so the backend has something real to talk to.
///
///   anvil &
///   forge script script/LocalDemo.s.sol --rpc-url http://127.0.0.1:8545 --broadcast \
///     --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
contract LocalDemo is Script {
    function run() external {
        // anvil account #1 — a stand-in customer.
        address customer = 0x70997970C51812dc3A010C7d01b50e0d17dc79C8;

        vm.startBroadcast();
        MockERC20 usdc = new MockERC20("USD Coin", "USDC", 6);
        SubscriptionBilling billing = new SubscriptionBilling(IERC20(address(usdc)), msg.sender, msg.sender);
        billing.setPlan(1, 5_000_000, true, "hobby");
        billing.setPlan(2, 20_000_000, true, "pro");
        usdc.mint(customer, 1000e6);
        vm.stopBroadcast();

        console2.log("USDC              :", address(usdc));
        console2.log("BILLING_ADDRESS   :", address(billing));
        console2.log("funded customer   :", customer);
        console2.log("");
        console2.log("Subscribe as the customer:");
        console2.log("  cast send <USDC> 'approve(address,uint256)' <BILLING> <max> --private-key <key2>");
        console2.log("  cast send <BILLING> 'subscribe(uint8,uint256)' 1 15000000 --private-key <key2>");
    }
}
