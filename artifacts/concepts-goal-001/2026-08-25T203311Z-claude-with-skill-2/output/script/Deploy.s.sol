// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SubscriptionBilling} from "../src/SubscriptionBilling.sol";

/// @notice Deploys the billing contract and creates the two launch plans in one broadcast.
///
/// Base mainnet:
///   forge script script/Deploy.s.sol --rpc-url base --broadcast --verify --account deployer
/// Base Sepolia:
///   forge script script/Deploy.s.sol --rpc-url base_sepolia --broadcast --verify --account deployer
///
/// Env (all optional, sane per-chain defaults below):
///   USDC_ADDRESS   billing token; defaults to canonical USDC on Base / Base Sepolia
///   BILLING_OWNER  plan admin + revenue recipient; defaults to the broadcasting address
///   HOBBY_PRICE    base units per 30 days, default 5_000_000  ($5)
///   PRO_PRICE      base units per 30 days, default 20_000_000 ($20)
contract Deploy is Script {
    address internal constant USDC_BASE = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    address internal constant USDC_BASE_SEPOLIA = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;

    function run() external returns (SubscriptionBilling billing) {
        address usdc = vm.envOr("USDC_ADDRESS", _defaultUsdc());
        require(usdc != address(0), "set USDC_ADDRESS for this chain");
        require(usdc.code.length > 0, "USDC_ADDRESS has no code on this chain");

        uint256 hobbyPrice = vm.envOr("HOBBY_PRICE", uint256(5e6));
        uint256 proPrice = vm.envOr("PRO_PRICE", uint256(20e6));

        vm.startBroadcast();
        address owner = vm.envOr("BILLING_OWNER", msg.sender);

        billing = new SubscriptionBilling(IERC20(usdc), owner);
        uint256 hobby = billing.createPlan(hobbyPrice);
        uint256 pro = billing.createPlan(proPrice);
        vm.stopBroadcast();

        console.log("chain id          ", block.chainid);
        console.log("SubscriptionBilling", address(billing));
        console.log("billing token      ", usdc);
        console.log("owner              ", owner);
        console.log("plan %s: hobby, %s base units / 30 days", hobby, hobbyPrice);
        console.log("plan %s: pro,   %s base units / 30 days", pro, proPrice);
        console.log("");
        console.log("Point your backend at isSubscribed(address) / paidThrough(address) on that address.");
    }

    function _defaultUsdc() internal view returns (address) {
        if (block.chainid == 8453) return USDC_BASE;
        if (block.chainid == 84532) return USDC_BASE_SEPOLIA;
        return address(0);
    }
}
