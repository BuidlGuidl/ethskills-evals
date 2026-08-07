// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./DeployHelpers.s.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { TipJar } from "../contracts/TipJar.sol";

/**
 * @notice Deploy script for the TipJar contract
 * @dev The USDC address is Base mainnet USDC. Because we develop against a Base fork
 *      (`yarn fork --network base`, chain id 31337), this exact address is live locally,
 *      so the jar and frontend interact with the real USDC contract.
 *
 * Example:
 * yarn deploy --file DeployTipJar.s.sol            # local Base fork
 * yarn deploy --file DeployTipJar.s.sol --network base  # real Base (requires keystore)
 */
contract DeployTipJar is ScaffoldETHDeploy {
    address constant BASE_USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;

    function run() external ScaffoldEthDeployerRunner {
        new TipJar(IERC20(BASE_USDC), deployer);
    }
}
