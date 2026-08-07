// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./DeployHelpers.s.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { TipJar } from "../contracts/TipJar.sol";

/**
 * @notice Deploy script for TipJar.
 * @dev USDC lives at the same canonical address on Base mainnet AND on a local Base fork
 *      (the fork copies real Base state), so we point at it directly. `USDC` can be
 *      overridden via env for other environments.
 *
 * Example:
 *   yarn deploy --file DeployTipJar.s.sol                 # local Base fork (anvil, chain 31337)
 *   yarn deploy --file DeployTipJar.s.sol --network base  # real Base (requires keystore)
 */
contract DeployTipJar is ScaffoldETHDeploy {
    // Circle-issued USDC on Base mainnet.
    address constant BASE_USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;

    function run() external ScaffoldEthDeployerRunner {
        address usdc = vm.envOr("USDC", BASE_USDC);
        new TipJar(IERC20(usdc), deployer);
    }
}
