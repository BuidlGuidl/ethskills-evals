// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SubscriptionBilling} from "../src/SubscriptionBilling.sol";

/// @notice Deploys the billing contract with the $5 and $20 plans seeded.
///
/// Usage:
///   forge script script/Deploy.s.sol --rpc-url base_sepolia --broadcast --verify
///
/// Required env: USDC_ADDRESS, BILLING_OWNER, plus whatever the signer flags need
/// (--account / --ledger / PRIVATE_KEY). Prefer a hardware wallet or a keystore account for
/// anything holding real money — the owner key is the one that can move revenue.
contract Deploy is Script {
    uint128 internal constant HOBBY_PRICE = 5_000_000; // $5 / 30 days, USDC has 6 decimals
    uint128 internal constant PRO_PRICE = 20_000_000; // $20 / 30 days

    function run() external returns (SubscriptionBilling billing) {
        address usdc = vm.envAddress("USDC_ADDRESS");
        address owner = vm.envAddress("BILLING_OWNER");

        _assertLooksLikeUsdc(usdc);

        uint128[] memory prices = new uint128[](2);
        prices[0] = HOBBY_PRICE;
        prices[1] = PRO_PRICE;

        vm.startBroadcast();
        billing = new SubscriptionBilling(IERC20(usdc), owner, prices);
        vm.stopBroadcast();

        console2.log("SubscriptionBilling:", address(billing));
        console2.log("  token :", usdc);
        console2.log("  owner :", owner);
        console2.log("  plan 1: $5/30d  (hobby)");
        console2.log("  plan 2: $20/30d (pro)");

        _record(address(billing), usdc, owner);
    }

    /// @dev Deploying against the wrong token address is the cheapest catastrophic mistake
    ///      available here — an 18-decimal token would make the $5 plan cost 5e-12 dollars.
    function _assertLooksLikeUsdc(address usdc) internal view {
        require(usdc.code.length > 0, "USDC_ADDRESS is not a contract on this chain");
        uint8 decimals = IERC20Metadata(usdc).decimals();
        require(decimals == 6, "token does not have 6 decimals - prices would be wrong");
        console2.log("token symbol:", IERC20Metadata(usdc).symbol());
    }

    /// @dev A tiny JSON file per chain so the backend and the ops scripts have one source of truth.
    function _record(address billing_, address usdc, address owner) internal {
        string memory key = "deployment";
        vm.serializeUint(key, "chainId", block.chainid);
        vm.serializeAddress(key, "billing", billing_);
        vm.serializeAddress(key, "token", usdc);
        vm.serializeAddress(key, "owner", owner);
        vm.serializeUint(key, "blockNumber", block.number);
        string memory out = vm.serializeUint(key, "deployedAt", block.timestamp);

        string memory path = string.concat("deployments/", vm.toString(block.chainid), ".json");
        vm.writeJson(out, path);
        console2.log("wrote", path);
    }
}
