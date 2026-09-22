// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "../interfaces/IERC20.sol";
import {SafeERC20} from "../lib/SafeERC20.sol";

contract MockAerodromeGauge {
    using SafeERC20 for IERC20;

    IERC20 public immutable lpToken;
    IERC20 public immutable rewardToken;
    mapping(address => uint256) public balanceOf;
    mapping(address => uint256) public earned;

    constructor(IERC20 lpToken_, IERC20 rewardToken_) {
        lpToken = lpToken_;
        rewardToken = rewardToken_;
    }

    function deposit(uint256 amount) external {
        lpToken.safeTransferFrom(msg.sender, address(this), amount);
        balanceOf[msg.sender] += amount;
    }

    function withdraw(uint256 amount) external {
        uint256 balance = balanceOf[msg.sender];
        require(balance >= amount, "GAUGE: balance");
        unchecked {
            balanceOf[msg.sender] = balance - amount;
        }
        lpToken.safeTransfer(msg.sender, amount);
    }

    function notifyReward(address account, uint256 amount) external {
        rewardToken.safeTransferFrom(msg.sender, address(this), amount);
        earned[account] += amount;
    }

    function getReward(address account) external {
        uint256 reward = earned[account];
        if (reward == 0) return;
        earned[account] = 0;
        rewardToken.safeTransfer(account, reward);
    }
}

