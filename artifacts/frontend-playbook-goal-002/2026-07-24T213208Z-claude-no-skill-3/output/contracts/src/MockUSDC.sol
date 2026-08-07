// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title MockUSDC
/// @notice A 6-decimal ERC20 that mimics USDC for LOCAL development only.
///         It exposes an open `faucet` so anyone testing locally can grab
///         some test USDC. Never deploy this to a real network.
contract MockUSDC is ERC20 {
    uint8 private constant _DECIMALS = 6;

    constructor() ERC20("Mock USD Coin", "USDC") {}

    function decimals() public pure override returns (uint8) {
        return _DECIMALS;
    }

    /// @notice Mint `amount` (6 decimals) of test USDC to `to`.
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    /// @notice Mint 1,000 test USDC to the caller.
    function faucet() external {
        _mint(msg.sender, 1_000 * 10 ** _DECIMALS);
    }
}
