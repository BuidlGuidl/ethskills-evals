// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./DeployHelpers.s.sol";
import { TipJar } from "../contracts/TipJar.sol";
import { MockUSDC } from "../contracts/test/MockUSDC.sol";

/**
 * @notice Deploy script for TipJar.
 * @dev Example:
 *      yarn deploy --file DeployTipJar.s.sol   # local anvil / Base fork
 *
 *      The jar is pointed at canonical Base USDC. On a Base fork (`yarn fork --network base`)
 *      that address holds the real token, so tipping exercises the real USDC contract.
 *      On an empty `yarn chain` there is no code at that address, so this script deploys a
 *      MockUSDC instead and points the jar at that.
 */
contract DeployTipJar is ScaffoldETHDeploy {
    /// @notice Canonical USDC on Base mainnet (6 decimals).
    address public constant BASE_USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;

    function run() external ScaffoldEthDeployerRunner {
        address tipToken = BASE_USDC;

        if (BASE_USDC.code.length == 0) {
            // Empty local chain: no USDC deployed here, so stand up a stand-in.
            MockUSDC mock = new MockUSDC();
            tipToken = address(mock);
            console.logString("No USDC at the Base address - deployed MockUSDC for local testing.");
            console.logString("Run `yarn fork --network base` instead to tip with real USDC.");
        }

        new TipJar(deployer, tipToken);
    }
}
