// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { IAerodromeGauge } from "../../src/interfaces/IAerodrome.sol";
import { IERC20 } from "../../src/interfaces/IERC20.sol";
import { MockERC20 } from "./MockERC20.sol";

contract MockAerodromeGauge is IAerodromeGauge {
    IERC20 public immutable lp;
    MockERC20 public immutable reward;
    uint256 public rewardPerClaim;

    mapping(address => uint256) public override balanceOf;

    constructor(IERC20 lp_, MockERC20 reward_) {
        lp = lp_;
        reward = reward_;
    }

    function setRewardPerClaim(uint256 amount) external {
        rewardPerClaim = amount;
    }

    function deposit(uint256 amount) external override {
        require(lp.transferFrom(msg.sender, address(this), amount), "LP_TRANSFER");
        balanceOf[msg.sender] += amount;
    }

    function withdraw(uint256 amount) external override {
        uint256 balance = balanceOf[msg.sender];
        require(balance >= amount, "GAUGE_BALANCE");
        unchecked {
            balanceOf[msg.sender] = balance - amount;
        }
        require(lp.transfer(msg.sender, amount), "LP_TRANSFER");
    }

    function getReward(address account) external override {
        if (rewardPerClaim != 0) reward.mint(account, rewardPerClaim);
    }
}
