// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./DeployHelpers.s.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { Toolshed } from "../contracts/Toolshed.sol";
import { MockUSDC } from "../contracts/mocks/MockUSDC.sol";

/**
 * @notice Deploys Toolshed against the right USDC for the chain.
 *
 *  - Base mainnet (8453) and Base Sepolia (84532): Circle USDC, addresses verified onchain.
 *  - A Base fork or a plain local Anvil (31337): uses USDC_ADDRESS from .env if you set one
 *    (that is the case when you `yarn fork --network base`), otherwise deploys MockUSDC.
 *
 * Env vars (packages/foundry/.env):
 *   STEWARD_ADDRESS  the association's multisig; gets DEFAULT_ADMIN_ROLE + STEWARD_ROLE.
 *                    Defaults to the deployer on a local chain only — on a live chain it is required.
 *   USDC_ADDRESS     override the deposit token (fork testing, or a chain not listed above).
 *   INITIAL_MEMBERS  optional comma-free list is not supported; seed members with
 *                    `addMembers` after deploy, or edit this script for your rollout.
 *
 * Example:
 *   yarn deploy --file DeployToolshed.s.sol                     # local
 *   yarn deploy --file DeployToolshed.s.sol --network baseSepolia
 */
contract DeployToolshed is ScaffoldETHDeploy {
    address constant USDC_BASE = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    address constant USDC_BASE_SEPOLIA = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;

    error StewardRequired();

    function run() external ScaffoldEthDeployerRunner {
        address usdc = _depositToken();
        address steward = vm.envOr("STEWARD_ADDRESS", address(0));
        if (steward == address(0)) {
            // Convenience for local runs; a live deploy must name a real steward (use a Safe).
            if (block.chainid != 31337) revert StewardRequired();
            steward = deployer;
        }

        address[] memory initialMembers = new address[](1);
        initialMembers[0] = steward; // the steward is a neighbor too; everyone else via addMembers

        Toolshed toolshed = new Toolshed(IERC20(usdc), steward, initialMembers);

        deployments.push(Deployment({ name: "Toolshed", addr: address(toolshed) }));

        console.log("Toolshed:", address(toolshed));
        console.log("  deposit token:", usdc);
        console.log("  steward:", steward);
    }

    function _depositToken() internal returns (address) {
        address configured = vm.envOr("USDC_ADDRESS", address(0));
        if (configured != address(0)) return configured;
        if (block.chainid == 8453) return USDC_BASE;
        if (block.chainid == 84532) return USDC_BASE_SEPOLIA;
        if (block.chainid == 31337) {
            MockUSDC mock = new MockUSDC();
            console.log("MockUSDC (local only):", address(mock));
            deployments.push(Deployment({ name: "MockUSDC", addr: address(mock) }));
            return address(mock);
        }
        revert("Set USDC_ADDRESS for this chain");
    }
}
