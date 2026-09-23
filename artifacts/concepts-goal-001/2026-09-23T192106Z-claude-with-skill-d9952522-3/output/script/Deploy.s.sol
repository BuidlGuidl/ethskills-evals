// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {Subscriptions} from "../src/Subscriptions.sol";
import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";

/// @notice Deploys the billing contract and creates the $5 and $20 plans.
///
///         Plans are immutable once created, so the numbers below are the numbers your
///         first customers are charged for as long as they stay subscribed. Read them
///         twice before broadcasting.
contract Deploy is Script {
    // Circle's canonical USDC, 6 decimals.
    address constant USDC_BASE = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    address constant USDC_BASE_SEPOLIA = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;

    uint128 constant HOBBY_PRICE = 5e6; // $5.00
    uint128 constant PRO_PRICE = 20e6; // $20.00
    uint64 constant BILLING_PERIOD = 30 days; // "monthly" means 30 days, everywhere

    function run() external returns (Subscriptions sub) {
        address usdc = _usdc();
        // The owner can withdraw revenue and open or close plans. Nothing else.
        // Use an address you can still sign with in two years — ideally a multisig.
        address owner = vm.envAddress("OWNER");

        // One broadcast block for the whole deployment: separate blocks get their nonces
        // computed before the earlier batch lands, which fails on a live RPC.
        vm.startBroadcast();
        sub = new Subscriptions(IERC20(usdc), owner);

        // Plans have to be added by the owner. If OWNER is the deployer we can do it in
        // the same run; if it is a multisig, submit these two calls from there.
        bool deployerIsOwner = owner == msg.sender;
        if (deployerIsOwner) {
            sub.addPlan(HOBBY_PRICE, BILLING_PERIOD);
            sub.addPlan(PRO_PRICE, BILLING_PERIOD);
        }
        vm.stopBroadcast();

        if (deployerIsOwner) {
            console.log("plan 1: hobby, $5 / 30 days");
            console.log("plan 2: pro,   $20 / 30 days");
        } else {
            console.log("Owner is not the deployer. From the owner address, call:");
            console.log("  addPlan(%s, %s)  // hobby", HOBBY_PRICE, BILLING_PERIOD);
            console.log("  addPlan(%s, %s)  // pro", PRO_PRICE, BILLING_PERIOD);
        }

        console.log("Subscriptions: %s", address(sub));
        console.log("billing token: %s", usdc);
        console.log("owner:         %s", owner);
    }

    function _usdc() internal view returns (address) {
        if (block.chainid == 8453) return USDC_BASE;
        if (block.chainid == 84532) return USDC_BASE_SEPOLIA;
        // Anvil or anywhere else: point at whatever token you deployed for testing.
        return vm.envAddress("USDC");
    }
}
