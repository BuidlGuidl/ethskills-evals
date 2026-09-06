// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {SubscriptionBilling} from "../src/SubscriptionBilling.sol";
import {IERC20} from "../src/IERC20.sol";

/// @notice Deploys SubscriptionBilling and writes an address record under deployments/.
///
/// Usage:
///   forge script script/Deploy.s.sol --rpc-url base_sepolia --broadcast --verify
///
/// Required env: PRIVATE_KEY (deployer), BILLING_OWNER (who collects revenue).
/// Optional env: USDC (override the built-in per-chain address),
///               HOBBY_PRICE / PRO_PRICE (token units, default 5e6 / 20e6).
contract Deploy is Script {
    function run() external returns (SubscriptionBilling billing) {
        address usdc = _usdc();
        address owner = vm.envAddress("BILLING_OWNER");
        uint128 hobby = uint128(vm.envOr("HOBBY_PRICE", uint256(5e6)));
        uint128 pro = uint128(vm.envOr("PRO_PRICE", uint256(20e6)));

        require(usdc.code.length > 0, "USDC address has no code on this chain");
        require(owner != address(0), "BILLING_OWNER unset");

        uint8[] memory ids = new uint8[](2);
        uint128[] memory prices = new uint128[](2);
        (ids[0], prices[0]) = (1, hobby); // hobby
        (ids[1], prices[1]) = (2, pro); // pro

        vm.startBroadcast(vm.envUint("PRIVATE_KEY"));
        billing = new SubscriptionBilling(IERC20(usdc), owner, ids, prices);
        vm.stopBroadcast();

        console2.log("SubscriptionBilling:", address(billing));
        console2.log("  chainId :", block.chainid);
        console2.log("  token   :", usdc);
        console2.log("  owner   :", owner);
        console2.log("  hobby   :", hobby);
        console2.log("  pro     :", pro);

        _record(address(billing), usdc, owner);
    }

    /// @dev Getting this address wrong means a contract nobody can pay into, so it is hardcoded
    ///      per chain rather than left to a copy-paste. All of these are native (Circle-issued)
    ///      USDC, not a bridged variant.
    function _usdc() internal view returns (address a) {
        a = vm.envOr("USDC", address(0));
        if (a != address(0)) return a;
        if (block.chainid == 8453) return 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913; // Base
        if (block.chainid == 84532) return 0x036CbD53842c5426634e7929541eC2318f3dCF7e; // Base Sepolia
        if (block.chainid == 42161) return 0xaf88d065e77c8cC2239327C5EDb3A432268e5831; // Arbitrum One
        if (block.chainid == 10) return 0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85; // OP Mainnet
        if (block.chainid == 1) return 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48; // Ethereum
        revert("no USDC address for this chain; set USDC env var");
    }

    function _record(address billing, address usdc, address owner) internal {
        string memory k = "deployment";
        vm.serializeUint(k, "chainId", block.chainid);
        vm.serializeAddress(k, "billing", billing);
        vm.serializeAddress(k, "token", usdc);
        vm.serializeUint(k, "deployedAtBlock", block.number);
        string memory json = vm.serializeAddress(k, "owner", owner);
        vm.writeJson(json, string.concat("./deployments/", vm.toString(block.chainid), ".json"));
    }
}
