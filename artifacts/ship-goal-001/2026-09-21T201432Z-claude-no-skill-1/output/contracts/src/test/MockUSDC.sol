// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC20} from "openzeppelin-contracts/token/ERC20/ERC20.sol";

/// @notice Stand-in for USDC on a local anvil node. Six decimals, anyone can mint. Never deploy this to a
///         network where people think it is real money.
contract MockUSDC is ERC20 {
    constructor() ERC20("Mock USD Coin", "USDC") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
