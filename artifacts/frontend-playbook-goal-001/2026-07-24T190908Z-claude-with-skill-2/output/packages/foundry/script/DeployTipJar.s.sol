// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./DeployHelpers.s.sol";
import "../contracts/TipJar.sol";

/**
 * @notice Deploy script for the TipJar contract.
 * @dev Uses the canonical Base USDC address. This works both on a Base fork
 *      (chain id 31337, where the real USDC contract state is present) and on
 *      Base mainnet (chain id 8453) because the address is identical on both.
 *
 * Examples:
 *   yarn deploy --file DeployTipJar.s.sol                 # local Base fork
 *   yarn deploy --file DeployTipJar.s.sol --network base  # Base mainnet
 */
contract DeployTipJar is ScaffoldETHDeploy {
    // USDC on Base (native Circle USDC), identical on a Base fork and Base mainnet.
    address constant BASE_USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;

    function run() external ScaffoldEthDeployerRunner {
        new TipJar(BASE_USDC, deployer);
    }
}
