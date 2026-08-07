// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./DeployHelpers.s.sol";
import "../contracts/TipJar.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @notice Deploy script for the TipJar contract.
 * @dev Deploys a jar that accepts Base USDC. When running against a fork of Base
 *      (see `yarn fork`), the real USDC contract already lives at this address,
 *      so approve/transferFrom work against real token state.
 *
 * The USDC address can be overridden with the USDC_ADDRESS env var if needed.
 */
contract DeployTipJar is ScaffoldETHDeploy {
    // Base mainnet USDC.
    address constant BASE_USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;

    function run() external ScaffoldEthDeployerRunner {
        address usdc = vm.envOr("USDC_ADDRESS", BASE_USDC);
        new TipJar(IERC20(usdc), deployer);
    }
}
