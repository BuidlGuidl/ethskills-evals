// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./DeployHelpers.s.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { TipJar } from "../contracts/TipJar.sol";

/**
 * @notice Deploy script for the TipJar contract.
 * @dev The tip token is the canonical Base USDC. Because the local demo runs against
 *      a fork of Base (chain id 31337), the same address resolves on both the fork and
 *      real Base, so no network-specific branching is needed here.
 *
 * Example:
 *   yarn deploy --file DeployTipJar.s.sol            # local fork / anvil
 *   yarn deploy --file DeployTipJar.s.sol --network base
 */
contract DeployTipJar is ScaffoldETHDeploy {
    /// @notice Canonical USDC on Base (same address on the local Base fork).
    address constant BASE_USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;

    function run() external ScaffoldEthDeployerRunner {
        new TipJar(IERC20(BASE_USDC), deployer);
    }
}
