// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./DeployHelpers.s.sol";
import { TipJar } from "../contracts/TipJar.sol";

/**
 * @notice Deploy script for the TipJar contract.
 * @dev The USDC address is the canonical Base USDC. On a local Base fork
 *      (`yarn fork base`, chain-id 31337) the fork mirrors Base state, so the
 *      same token address holds real balances — no config changes needed
 *      between local demos and a real Base deployment.
 *
 * Example:
 *   yarn deploy --file DeployTipJar.s.sol            # local anvil / Base fork
 *   yarn deploy --file DeployTipJar.s.sol --network base
 */
contract DeployTipJar is ScaffoldETHDeploy {
    // Circle-issued native USDC on Base mainnet.
    address constant BASE_USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;

    function run() external ScaffoldEthDeployerRunner {
        new TipJar(BASE_USDC, deployer);
    }
}
