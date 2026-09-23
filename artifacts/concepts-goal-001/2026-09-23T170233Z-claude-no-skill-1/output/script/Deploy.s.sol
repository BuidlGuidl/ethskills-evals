// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {IERC20} from "openzeppelin-contracts/token/ERC20/IERC20.sol";

import {SubscriptionBilling} from "../src/SubscriptionBilling.sol";
import {Addresses} from "./Addresses.sol";
import {MockUSDC} from "../test/mocks/MockUSDC.sol";

/// @notice Deploys the billing contract and seeds the two plans.
///
/// Usage:
///   forge script script/Deploy.s.sol --rpc-url base_sepolia --broadcast --verify
///
/// Environment:
///   BILLING_OWNER   address that receives revenue and administers plans (required)
///   USDC_ADDRESS    override the built-in per-chain USDC address (optional)
///   HOBBY_PRICE     hobby plan price in USDC base units (default 5_000_000)
///   PRO_PRICE       pro plan price in USDC base units   (default 20_000_000)
contract Deploy is Script {
    uint8 internal constant HOBBY = 1;
    uint8 internal constant PRO = 2;

    function run() external returns (SubscriptionBilling billing, address token) {
        address owner = vm.envAddress("BILLING_OWNER");
        uint128 hobbyPrice = uint128(vm.envOr("HOBBY_PRICE", uint256(5_000_000)));
        uint128 proPrice = uint128(vm.envOr("PRO_PRICE", uint256(20_000_000)));

        token = vm.envOr("USDC_ADDRESS", Addresses.usdc(block.chainid));

        vm.startBroadcast();

        if (token == address(0)) {
            require(!Addresses.isProduction(block.chainid), "refusing to mock USDC on mainnet");
            token = address(new MockUSDC());
            console2.log("Deployed MockUSDC (dev only) at", token);
        }

        // A wrong token address would silently accept deposits that can never
        // be honoured, so fail loudly here rather than after launch.
        require(token.code.length > 0, "no contract at USDC address");
        require(IERC20(token).totalSupply() >= 0, "USDC address is not an ERC-20");

        billing = new SubscriptionBilling(IERC20(token), owner);
        console2.log("SubscriptionBilling", address(billing));

        // Plans are set by the deployer only if the deployer is the owner;
        // otherwise the owner runs script/Ops.s.sol:SetPlan afterwards.
        if (msg.sender == owner) {
            billing.setPlan(HOBBY, hobbyPrice, true);
            billing.setPlan(PRO, proPrice, true);
            console2.log("Plans seeded: hobby", hobbyPrice, "pro", proPrice);
        } else {
            console2.log("Deployer is not the owner; run Ops:SetPlan as", owner);
        }

        vm.stopBroadcast();

        _writeDeployment(address(billing), token, owner);
    }

    /// @dev A committed JSON record per chain, so the backend and ops scripts
    /// have one source of truth for the address instead of a copy-pasted string.
    function _writeDeployment(address billing, address token, address owner) internal {
        string memory key = "deployment";
        vm.serializeUint(key, "chainId", block.chainid);
        vm.serializeAddress(key, "subscriptionBilling", billing);
        vm.serializeAddress(key, "usdc", token);
        vm.serializeAddress(key, "owner", owner);
        vm.serializeUint(key, "deployedAtBlock", block.number);
        string memory json = vm.serializeUint(key, "deployedAt", block.timestamp);

        string memory path = string.concat("deployments/", Addresses.name(block.chainid), ".json");
        vm.writeJson(json, path);
        console2.log("Wrote", path);
    }
}
