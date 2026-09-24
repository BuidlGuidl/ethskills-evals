// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @dev USDC-shaped token with a deny list, like the real one. Used to prove that a frozen
///      neighbour cannot pin anyone else's deposit in escrow.
contract BlockableUSDC is ERC20 {
    mapping(address => bool) public frozen;

    error Blacklisted(address account);

    constructor() ERC20("USD Coin (blockable mock)", "USDC") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function setFrozen(address account, bool value) external {
        frozen[account] = value;
    }

    function _update(address from, address to, uint256 value) internal override {
        if (frozen[from]) revert Blacklisted(from);
        if (frozen[to]) revert Blacklisted(to);
        super._update(from, to, value);
    }
}
