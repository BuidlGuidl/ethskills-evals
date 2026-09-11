// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./DeployHelpers.s.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { TipJar } from "../contracts/TipJar.sol";

/**
 * @notice Deploy script for the TipJar contract.
 * @dev The jar is wired to canonical USDC. Locally that means running against a Base fork
 *      (`yarn fork --network base`), which copies the real token's state into Anvil.
 *
 * Example:
 * yarn deploy --file DeployTipJar.s.sol  # local anvil / base fork
 */
contract DeployTipJar is ScaffoldETHDeploy {
    /// @dev Canonical USDC on Base (and on a local fork of Base).
    address constant BASE_USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    /// @dev Circle USDC on Base Sepolia, for testnet runs.
    address constant BASE_SEPOLIA_USDC = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;

    function run() external ScaffoldEthDeployerRunner {
        address usdc = usdcAddress();
        require(
            usdc.code.length > 0,
            "No USDC found at the expected address. Start a Base fork first: yarn fork --network base"
        );
        new TipJar(IERC20(usdc), deployer);
    }

    function usdcAddress() internal view returns (address) {
        if (block.chainid == 84532) return BASE_SEPOLIA_USDC;
        // 8453 = Base, 31337 = local Anvil forked from Base.
        return BASE_USDC;
    }
}
