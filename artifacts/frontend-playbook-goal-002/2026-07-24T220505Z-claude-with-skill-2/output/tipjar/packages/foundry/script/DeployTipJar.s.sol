// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./DeployHelpers.s.sol";
import "../contracts/TipJar.sol";

/**
 * @notice Deploy script for the TipJar contract.
 * @dev Because we run against a fork of Base (chain id 31337), the real Base USDC
 *      contract already exists at its mainnet address and is used as the tip token.
 *
 * Example:
 *   yarn deploy --file DeployTipJar.s.sol
 */
contract DeployTipJar is ScaffoldETHDeploy {
    /// @dev Canonical USDC on Base (also present on a Base fork).
    address constant BASE_USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;

    function run() external ScaffoldEthDeployerRunner {
        // The deployer becomes the owner, so it can withdraw collected tips.
        new TipJar(BASE_USDC, deployer);
    }
}
