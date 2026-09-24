// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";

/// @dev Stand-in for USDC in unit tests: 6 decimals plus the blacklist that
///      real USDC has, so we can exercise the deferred-payout path.
contract MockUSDC is ERC20 {
    mapping(address => bool) public blacklisted;

    constructor() ERC20("USD Coin", "USDC") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function setBlacklisted(address account, bool value) external {
        blacklisted[account] = value;
    }

    function _update(address from, address to, uint256 value) internal override {
        require(!blacklisted[from] && !blacklisted[to], "USDC: blacklisted");
        super._update(from, to, value);
    }
}
