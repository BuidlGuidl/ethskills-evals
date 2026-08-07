// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./DeployHelpers.s.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { TipJar } from "../contracts/TipJar.sol";

/**
 * @notice Deploy script for the TipJar contract.
 * @dev The jar is denominated in USDC. On a Base fork (or Base mainnet) this is the
 *      canonical Base USDC. Override with the USDC_ADDRESS env var if needed.
 *
 * Example:
 *   yarn deploy --file DeployTipJar.s.sol            # local anvil / Base fork
 *   yarn deploy --file DeployTipJar.s.sol --network base
 */
contract DeployTipJar is ScaffoldETHDeploy {
    // Canonical USDC on Base (mainnet and mainnet forks share this address).
    address constant BASE_USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;

    function run() external ScaffoldEthDeployerRunner {
        address usdc = vm.envOr("USDC_ADDRESS", BASE_USDC);
        new TipJar(IERC20(usdc), deployer);
    }
}
