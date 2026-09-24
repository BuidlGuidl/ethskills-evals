// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "../../src/interfaces/IERC20.sol";
import {SafeTransferLib} from "../../src/lib/SafeTransferLib.sol";
import {MockERC20} from "./MockERC20.sol";

contract MockAerodromeGauge {
    using SafeTransferLib for IERC20;

    IERC20 public immutable stakingToken;
    MockERC20 public immutable rewardToken;
    uint256 public rewardPerHarvest;

    mapping(address => uint256) public balanceOf;

    constructor(IERC20 stakingToken_, MockERC20 rewardToken_) {
        stakingToken = stakingToken_;
        rewardToken = rewardToken_;
    }

    function setRewardPerHarvest(uint256 rewardPerHarvest_) external {
        rewardPerHarvest = rewardPerHarvest_;
    }

    function deposit(uint256 amount) external {
        stakingToken.safeTransferFrom(msg.sender, address(this), amount);
        balanceOf[msg.sender] += amount;
    }

    function withdraw(uint256 amount) external {
        balanceOf[msg.sender] -= amount;
        stakingToken.safeTransfer(msg.sender, amount);
    }

    function getReward(address account) external {
        if (rewardPerHarvest > 0) rewardToken.mint(account, rewardPerHarvest);
    }
}

