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
 * yarn deploy --file DeployTipJar.s.sol  # local anvil chain (must be a Base fork)
 */
contract DeployTipJar is ScaffoldETHDeploy {
    /// @dev Circle's native USDC on Base mainnet. A Base fork keeps the same address.
    address public constant BASE_USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;

    error NoUsdcAtAddress(address usdc);

    function run() external ScaffoldEthDeployerRunner {
        address usdc = vm.envOr("USDC_ADDRESS", BASE_USDC);

        // A plain `yarn chain` has no USDC, so the jar would deploy against an empty
        // address and every tip would revert. Fail loudly instead.
        if (usdc.code.length == 0) {
            console.log("No USDC contract found at", usdc);
            console.log("Start a Base fork with `yarn fork` before deploying.");
            revert NoUsdcAtAddress(usdc);
        }

        new TipJar(usdc, deployer);
    }
}
