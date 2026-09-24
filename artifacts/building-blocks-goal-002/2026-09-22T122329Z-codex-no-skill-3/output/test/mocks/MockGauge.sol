// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {MockERC20} from "./MockERC20.sol";
import {MockPair} from "./MockPair.sol";

contract MockGauge {
    MockPair public immutable lpToken;
    MockERC20 public immutable rewardToken;
    mapping(address => uint256) public balanceOf;
    mapping(address => uint256) public pendingReward;

    constructor(MockPair lpToken_, MockERC20 rewardToken_) {
        lpToken = lpToken_;
        rewardToken = rewardToken_;
    }

    function setPendingReward(address account, uint256 amount) external {
        pendingReward[account] = amount;
    }

    function deposit(uint256 amount) external {
        lpToken.transferFrom(msg.sender, address(this), amount);
        balanceOf[msg.sender] += amount;
    }

    function withdraw(uint256 amount) external {
        uint256 staked = balanceOf[msg.sender];
        require(staked >= amount, "STAKE");
        balanceOf[msg.sender] = staked - amount;
        lpToken.transfer(msg.sender, amount);
    }

    function getReward(address account) external {
        uint256 reward = pendingReward[account];
        pendingReward[account] = 0;
        if (reward > 0) rewardToken.mint(account, reward);
    }
}

