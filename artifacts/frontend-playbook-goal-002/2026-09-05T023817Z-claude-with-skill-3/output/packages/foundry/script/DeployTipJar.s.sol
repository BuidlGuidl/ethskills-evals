// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./DeployHelpers.s.sol";
import "../contracts/TipJar.sol";

/**
 * @notice Deploy script for the TipJar contract
 * @dev Inherits ScaffoldETHDeploy which:
 *      - Includes forge-std/Script.sol for deployment
 *      - Includes ScaffoldEthDeployerRunner modifier
 *      - Provides `deployer` variable
 * Example:
 * yarn deploy --file DeployTipJar.s.sol  # local anvil chain / Base fork
 */
contract DeployTipJar is ScaffoldETHDeploy {
    /// @notice Circle's native USDC on Base. The same address on a Base fork.
    address public constant BASE_USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;

    function run() external ScaffoldEthDeployerRunner {
        require(BASE_USDC.code.length > 0, "No USDC at the Base USDC address: are you running a Base fork? (yarn fork)");
        new TipJar(deployer, BASE_USDC);
    }
}
