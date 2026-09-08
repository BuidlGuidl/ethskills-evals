// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./DeployHelpers.s.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { TipJar } from "../contracts/TipJar.sol";

/**
 * @notice Deploy script for the TipJar contract
 * @dev The jar points at the canonical USDC on Base. That token only exists on Base itself
 *      and on a fork of it, so the local chain must be started with `yarn fork --network base`
 *      (a bare `yarn chain` has no USDC and this script will tell you so).
 *
 * Example:
 * yarn deploy --file DeployTipJar.s.sol             # local anvil fork of Base
 * USDC_ADDRESS=0x... yarn deploy --file DeployTipJar.s.sol   # point at a different ERC20
 */
contract DeployTipJar is ScaffoldETHDeploy {
    /// @notice Canonical Circle USDC on Base (6 decimals).
    address constant BASE_USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;

    function run() external ScaffoldEthDeployerRunner {
        address usdc = vm.envOr("USDC_ADDRESS", BASE_USDC);

        require(
            usdc.code.length > 0,
            "DeployTipJar: no ERC20 code at the USDC address. Start the chain with `yarn fork --network base` instead of `yarn chain`."
        );

        TipJar tipJar = new TipJar(IERC20(usdc), deployer);

        console.log("TipJar deployed at", address(tipJar));
        console.log("  tip token:", usdc);
        console.log("  owner:    ", deployer);
    }
}
