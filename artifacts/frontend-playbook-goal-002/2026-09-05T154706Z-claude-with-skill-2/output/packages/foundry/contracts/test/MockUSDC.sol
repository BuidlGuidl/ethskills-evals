// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @notice A 6-decimal stand-in for USDC, used only when running against an empty
 *         local chain (`yarn chain`) where the real Base USDC does not exist.
 * @dev Freely mintable on purpose - it is a test fixture, never deployed to a live network.
 */
contract MockUSDC is ERC20 {
    constructor() ERC20("Mock USD Coin", "USDC") { }

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    /// @notice Mint yourself test USDC.
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
