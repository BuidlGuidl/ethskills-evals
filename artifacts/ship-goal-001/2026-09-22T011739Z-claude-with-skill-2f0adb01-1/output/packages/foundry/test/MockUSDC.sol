// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @dev Test-only stand-in for USDC: same 6 decimals, freely mintable. Real USDC is used in
///      the fork tests (test/ToolshedFork.t.sol) and in every deployment.
contract MockUSDC is ERC20 {
    constructor() ERC20("USD Coin", "USDC") { }

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// @dev USDC can blacklist an address, and transfers to it revert. This reproduces that so the
///      deferred-payout path can be tested.
contract BlockingUSDC is MockUSDC {
    mapping(address => bool) public blocked;

    function setBlocked(address account, bool value) external {
        blocked[account] = value;
    }

    function _update(address from, address to, uint256 value) internal override {
        require(!blocked[to] && !blocked[from], "Blacklistable: account is blocked");
        super._update(from, to, value);
    }
}
