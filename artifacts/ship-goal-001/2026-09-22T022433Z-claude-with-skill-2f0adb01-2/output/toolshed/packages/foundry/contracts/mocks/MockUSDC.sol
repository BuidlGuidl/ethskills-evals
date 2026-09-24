//SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @notice A 6-decimal stand-in for USDC with an open faucet, for local development only.
 * @dev The deploy script refuses to deploy this on any chain other than a local Anvil node
 *      (chain id 31337). On Base and Base Sepolia, Toolshed points at the real Circle USDC.
 */
contract MockUSDC is ERC20 {
    constructor() ERC20("Mock USD Coin", "USDC") { }

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    /// @notice Grab test dollars. Local chains only — see the deploy script.
    function faucet(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
