// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./DeployHelpers.s.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { TipJar } from "../contracts/TipJar.sol";

/**
 * @notice Deploy script for the TipJar contract
 * @dev Deploys against whatever USDC the target chain has. On a Base fork (chain id 31337)
 *      the canonical Base USDC is already deployed at its mainnet address, so the same
 *      constant works locally and on Base itself.
 * Example:
 * yarn deploy --file DeployTipJar.s.sol  # local anvil chain / Base fork
 */
contract DeployTipJar is ScaffoldETHDeploy {
    /// @notice Circle's native USDC on Base — identical address on a Base fork.
    address public constant BASE_USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;

    error UsdcNotDeployed(address usdc);

    /**
     * @dev Deployer setup based on `ETH_KEYSTORE_ACCOUNT` in `.env`:
     *      - "scaffold-eth-default": Uses Anvil's account #9 (0xa0Ee7A142d267C1f36714E4a8F75612F20a79720), no password prompt
     *      - "scaffold-eth-custom": requires password used while creating keystore
     */
    function run() external ScaffoldEthDeployerRunner {
        address usdc = vm.envOr("USDC_ADDRESS", BASE_USDC);

        // A plain `yarn chain` has no USDC at this address, and the constructor's
        // decimals() call would revert with an opaque error. Say so plainly instead.
        if (usdc.code.length == 0) revert UsdcNotDeployed(usdc);

        TipJar tipJar = new TipJar(IERC20(usdc), deployer);
        console.log("TipJar owner:", tipJar.owner());
        console.log("Accepting tips in token:", address(tipJar.token()));
    }
}
