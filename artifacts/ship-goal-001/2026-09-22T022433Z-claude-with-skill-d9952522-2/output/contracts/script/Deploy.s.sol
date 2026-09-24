// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Toolshed} from "../src/Toolshed.sol";

/// @notice Deploys Toolshed. See README "Deploying" for the exact command line.
///
/// Env:
///   STEWARD_ADDRESS   required - the association multisig that will own the roster
///   INITIAL_MEMBERS   optional - comma-separated member addresses to seed the roster
///   USDC_ADDRESS      optional - overrides the built-in per-chain USDC address
contract Deploy is Script {
    /// @dev Circle native USDC. Both verified onchain with `cast call <addr> "symbol()(string)"`.
    address internal constant BASE_USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    address internal constant BASE_SEPOLIA_USDC = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;

    function run() external returns (Toolshed shed) {
        address steward = vm.envAddress("STEWARD_ADDRESS");
        address usdc = vm.envOr("USDC_ADDRESS", usdcForChain(block.chainid));
        address[] memory members = vm.envOr("INITIAL_MEMBERS", ",", new address[](0));

        require(usdc != address(0), "set USDC_ADDRESS for this chain");
        require(steward != address(0), "STEWARD_ADDRESS required");

        console.log("chain id        ", block.chainid);
        console.log("usdc            ", usdc);
        console.log("steward         ", steward);
        console.log("initial members ", members.length);

        vm.startBroadcast();
        shed = new Toolshed(IERC20(usdc), steward, members);
        vm.stopBroadcast();

        console.log("Toolshed        ", address(shed));
    }

    function usdcForChain(uint256 chainId) internal pure returns (address) {
        if (chainId == 8453) return BASE_USDC;
        if (chainId == 84532) return BASE_SEPOLIA_USDC;
        return address(0); // anvil / anything else: pass USDC_ADDRESS explicitly
    }
}
