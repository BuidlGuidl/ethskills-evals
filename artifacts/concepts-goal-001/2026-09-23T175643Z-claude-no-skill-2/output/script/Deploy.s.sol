// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

import {SubscriptionBilling} from "../src/SubscriptionBilling.sol";
import {UsdcAddresses} from "./UsdcAddresses.sol";

/**
 * @notice Deploys SubscriptionBilling with the hobby ($5) and pro ($20) plans.
 *
 * Env:
 *   OWNER       required — operator address. Use a multisig for mainnet.
 *   USDC        optional — override the built-in per-chain USDC address.
 *   HOBBY_PRICE optional — base units, default 5_000_000.
 *   PRO_PRICE   optional — base units, default 20_000_000.
 *
 * Writes deployments/<chainId>.json for the backend and ops scripts to read.
 */
contract Deploy is Script {
    function run() external returns (SubscriptionBilling billing) {
        address owner = vm.envAddress("OWNER");
        address usdc = vm.envOr("USDC", UsdcAddresses.forChain(block.chainid));

        uint128[] memory prices = new uint128[](2);
        prices[0] = uint128(vm.envOr("HOBBY_PRICE", uint256(5e6)));
        prices[1] = uint128(vm.envOr("PRO_PRICE", uint256(20e6)));

        // A 6-decimal assumption is baked into the $5/$20 defaults; catch a wrong token here rather
        // than after the first customer has been billed 1000x.
        require(IERC20Metadata(usdc).decimals() == 6, "payment token is not 6-decimal USDC");
        require(owner != address(0), "OWNER not set");

        vm.startBroadcast();
        billing = new SubscriptionBilling(IERC20(usdc), owner, prices);
        vm.stopBroadcast();

        console2.log("SubscriptionBilling:", address(billing));
        console2.log("USDC:               ", usdc);
        console2.log("owner:              ", owner);
        console2.log("hobby / pro (6dp):  ", prices[0], prices[1]);

        _record(address(billing), usdc, owner);
    }

    function _record(address billing_, address usdc, address owner) internal {
        string memory json = string.concat(
            '{\n  "chainId": ',
            vm.toString(block.chainid),
            ',\n  "subscriptionBilling": "',
            vm.toString(billing_),
            '",\n  "usdc": "',
            vm.toString(usdc),
            '",\n  "owner": "',
            vm.toString(owner),
            '",\n  "deployedAtBlock": ',
            vm.toString(block.number),
            "\n}\n"
        );
        vm.createDir("deployments", true);
        string memory path = string.concat("deployments/", vm.toString(block.chainid), ".json");
        vm.writeFile(path, json);
        console2.log("wrote", path);
    }
}
