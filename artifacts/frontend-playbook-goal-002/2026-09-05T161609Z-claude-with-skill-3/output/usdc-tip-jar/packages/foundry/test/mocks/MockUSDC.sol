// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice Minimal stand-in for USDC (6 decimals) used by the unit tests.
contract MockUSDC is ERC20 {
    constructor() ERC20("USD Coin", "USDC") { }

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// @notice Token that keeps 1% of every transfer, to prove the feed records what actually arrived.
contract FeeOnTransferUSDC is ERC20 {
    address constant FEE_SINK = address(0xFEE);

    constructor() ERC20("Fee USD Coin", "fUSDC") { }

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function _update(address from, address to, uint256 value) internal override {
        if (from != address(0) && to != address(0) && to != FEE_SINK) {
            uint256 fee = value / 100;
            if (fee > 0) {
                super._update(from, FEE_SINK, fee);
                value -= fee;
            }
        }
        super._update(from, to, value);
    }
}
