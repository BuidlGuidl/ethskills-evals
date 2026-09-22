// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {MockERC20} from "./MockERC20.sol";

contract MockGauge {
    MockERC20 public immutable lpToken;
    MockERC20 public immutable rewardToken;

    mapping(address => uint256) public balanceOf;
    mapping(address => uint256) public pendingReward;

    constructor(MockERC20 lpToken_, MockERC20 rewardToken_) {
        lpToken = lpToken_;
        rewardToken = rewardToken_;
    }

    function setPendingReward(address account, uint256 amount) external {
        pendingReward[account] = amount;
    }

    function deposit(uint256 amount) external {
        require(lpToken.transferFrom(msg.sender, address(this), amount), "LP_IN");
        balanceOf[msg.sender] += amount;
    }

    function withdraw(uint256 amount) external {
        require(balanceOf[msg.sender] >= amount, "BALANCE");
        balanceOf[msg.sender] -= amount;
        require(lpToken.transfer(msg.sender, amount), "LP_OUT");
    }

    function getReward(address account) external {
        uint256 amount = pendingReward[account];
        pendingReward[account] = 0;
        rewardToken.mint(account, amount);
    }
}

