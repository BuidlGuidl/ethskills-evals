//SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

/**
 * Routes USDC payouts straight to recipients and records them for the feed.
 */
contract Payouts {
    IERC20 public immutable usdc;

    event Paid(address indexed from, address indexed to, uint256 amount, string memo);

    constructor(address _usdc) {
        usdc = IERC20(_usdc);
    }

    function pay(address to, uint256 amount, string calldata memo) external {
        require(to != address(0), "Payouts: zero recipient");
        require(amount > 0, "Payouts: zero amount");
        require(usdc.transferFrom(msg.sender, to, amount), "Payouts: transfer failed");
        emit Paid(msg.sender, to, amount, memo);
    }
}
