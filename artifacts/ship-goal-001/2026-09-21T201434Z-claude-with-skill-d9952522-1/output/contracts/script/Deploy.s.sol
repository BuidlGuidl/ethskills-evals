// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {Toolshed} from "../src/Toolshed.sol";
import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";

/// @notice Deploys Toolshed against the canonical USDC for the target chain.
///
/// Toolshed has no owner, admin, pause or upgrade path, so there is nothing to
/// hand over to a multisig after deployment. The deploying key holds no
/// privileges over the contract once the transaction lands.
contract Deploy is Script {
    /// Circle-issued native USDC. Both from Circle's official contract-address docs.
    address internal constant BASE_MAINNET_USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    address internal constant BASE_SEPOLIA_USDC = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;

    function run() external returns (Toolshed shed) {
        address usdc = _usdcForChain();

        // Fail loudly rather than deploying an escrow pointed at an empty address.
        require(usdc.code.length > 0, "Deploy: no token code at USDC address");

        vm.startBroadcast();
        shed = new Toolshed(IERC20(usdc));
        vm.stopBroadcast();

        console2.log("chainid ", block.chainid);
        console2.log("usdc    ", usdc);
        console2.log("toolshed", address(shed));
    }

    function _usdcForChain() internal view returns (address) {
        if (block.chainid == 8453) return BASE_MAINNET_USDC;
        if (block.chainid == 84532) return BASE_SEPOLIA_USDC;
        // Anvil / other chains: pass an explicit token address.
        return vm.envAddress("USDC_ADDRESS");
    }
}
