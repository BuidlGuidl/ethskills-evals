// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./DeployHelpers.s.sol";
import "../contracts/TipJar.sol";

/**
 * @notice Deploy script for the TipJar contract.
 * @dev The deployer becomes the jar owner. The USDC address defaults to Base
 *      mainnet USDC (present on a Base fork) but can be overridden with the
 *      USDC_ADDRESS env var when deploying against a different token/network.
 *
 * Example: yarn deploy --file DeployTipJar.s.sol
 */
contract DeployTipJar is ScaffoldETHDeploy {
    // Base mainnet USDC — exists on a `yarn fork --network base` fork.
    address constant BASE_USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;

    function run() external ScaffoldEthDeployerRunner {
        address usdc = vm.envOr("USDC_ADDRESS", BASE_USDC);
        new TipJar(usdc, deployer);
    }
}
