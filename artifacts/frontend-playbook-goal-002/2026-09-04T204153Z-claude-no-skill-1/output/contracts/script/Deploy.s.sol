// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {TipJar} from "../src/TipJar.sol";

/**
 * @notice Deploys the tip jar.
 *
 * Environment:
 *   USDC_ADDRESS   token to accept (defaults to canonical USDC on Base)
 *   TIPJAR_OWNER   withdrawal owner (defaults to the broadcasting account)
 *
 *   forge script script/Deploy.s.sol:Deploy --rpc-url local --broadcast
 */
contract Deploy is Script {
    /// @dev Canonical Circle USDC on Base (6 decimals).
    address internal constant BASE_USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;

    function run() external returns (TipJar jar) {
        address usdc = vm.envOr("USDC_ADDRESS", BASE_USDC);
        address owner = vm.envOr("TIPJAR_OWNER", msg.sender);

        require(usdc.code.length > 0, "USDC_ADDRESS has no code on this chain -- is anvil forking Base?");

        vm.startBroadcast();
        jar = new TipJar(usdc, owner);
        vm.stopBroadcast();

        console.log("TipJar   :", address(jar));
        console.log("token    :", usdc);
        console.log("owner    :", owner);
    }
}
