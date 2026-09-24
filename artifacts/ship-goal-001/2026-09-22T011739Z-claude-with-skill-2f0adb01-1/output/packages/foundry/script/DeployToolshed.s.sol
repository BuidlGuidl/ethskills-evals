// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./DeployHelpers.s.sol";
import { Toolshed } from "../contracts/Toolshed.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @notice Deploys Toolshed against the right USDC for the chain it's running on.
 *
 * Usage:
 *   yarn deploy                                   # local anvil fork of Base
 *   yarn deploy --network baseSepolia
 *   yarn deploy --network base
 *
 * Env:
 *   STEWARD_ADDRESS  account that keeps the member roster and arbitrates disputes.
 *                    Defaults to the deployer locally; set it to your Safe on live networks.
 *   USDC_ADDRESS     override the built-in per-chain USDC address (needed on unknown chains).
 */
contract DeployToolshed is ScaffoldETHDeploy {
    // Verified onchain (symbol()/decimals()) — see README for how to re-check.
    address constant USDC_BASE = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    address constant USDC_BASE_SEPOLIA = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;
    address constant USDC_MAINNET = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;

    function run() external ScaffoldEthDeployerRunner {
        address usdc = _usdc();
        address steward = vm.envOr("STEWARD_ADDRESS", deployer);

        Toolshed toolshed = new Toolshed(IERC20(usdc), steward);

        console.log("Toolshed deployed with USDC", usdc);
        console.log("Steward", steward);

        // A fork of Base still has a real, empty Toolshed — seed the roster so `yarn start`
        // shows something. Anvil's default accounts, plus whoever the deployer is.
        if (block.chainid == 31337 && steward == deployer) {
            address[] memory neighbours = new address[](4);
            neighbours[0] = 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266; // anvil #0
            neighbours[1] = 0x70997970C51812dc3A010C7d01b50e0d17dc79C8; // anvil #1
            neighbours[2] = 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC; // anvil #2
            neighbours[3] = 0x90F79bf6EB2c4f870365E785982E1f101E93b906; // anvil #3
            toolshed.admitMembers(neighbours);
            console.log("Seeded 4 local members");
        }
    }

    function _usdc() internal view returns (address) {
        address override_ = vm.envOr("USDC_ADDRESS", address(0));
        if (override_ != address(0)) return override_;

        // 31337 here means an anvil *fork of Base* (`yarn fork`), where real USDC exists.
        if (block.chainid == 8453 || block.chainid == 31337) return USDC_BASE;
        if (block.chainid == 84532) return USDC_BASE_SEPOLIA;
        if (block.chainid == 1) return USDC_MAINNET;
        revert("Unknown chain: set USDC_ADDRESS");
    }
}
