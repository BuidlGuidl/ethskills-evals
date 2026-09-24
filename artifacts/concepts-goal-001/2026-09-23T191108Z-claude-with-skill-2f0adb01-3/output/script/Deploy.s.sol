// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {SubscriptionBilling} from "../src/SubscriptionBilling.sol";
import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";

/// @notice Deploys SubscriptionBilling with the $5 and $20 plans.
///
/// Usage:
///   forge script script/Deploy.s.sol --rpc-url base_sepolia --broadcast --verify
///
/// Reads USDC_ADDRESS / TREASURY / OWNER from the environment. USDC defaults to the canonical
/// Circle deployment for the chain being targeted, so you normally only set TREASURY and OWNER.
contract Deploy is Script {
    address internal constant USDC_BASE = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    address internal constant USDC_BASE_SEPOLIA = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;

    function run() external returns (SubscriptionBilling billing) {
        address usdc = vm.envOr("USDC_ADDRESS", _defaultUsdc());
        address treasury = vm.envAddress("TREASURY");
        address owner = vm.envOr("OWNER", treasury);

        require(usdc.code.length > 0, "USDC address has no code on this chain");

        uint128[] memory prices = new uint128[](2);
        prices[0] = 5e6; // plan 1 - hobby, $5 / 30 days
        prices[1] = 20e6; // plan 2 - pro,   $20 / 30 days

        vm.startBroadcast();
        billing = new SubscriptionBilling(IERC20(usdc), treasury, owner, prices);
        vm.stopBroadcast();

        console2.log("SubscriptionBilling:", address(billing));
        console2.log("  token   :", usdc);
        console2.log("  treasury:", treasury);
        console2.log("  owner   :", owner);
        console2.log("  plan 1  : hobby  5 USDC / 30 days");
        console2.log("  plan 2  : pro   20 USDC / 30 days");
    }

    function _defaultUsdc() internal view returns (address) {
        if (block.chainid == 8453) return USDC_BASE;
        if (block.chainid == 84532) return USDC_BASE_SEPOLIA;
        revert("set USDC_ADDRESS for this chain");
    }
}
