// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {IAerodromeGauge} from "../../src/interfaces/IAerodrome.sol";
import {IERC20} from "../../src/interfaces/IERC20.sol";
import {SafeTransferLib} from "../../src/lib/SafeTransferLib.sol";
import {MockERC20} from "./MockERC20.sol";

contract MockAerodromeGauge is IAerodromeGauge {
    using SafeTransferLib for IERC20;

    IERC20 public immutable lpToken;
    MockERC20 public immutable rewardToken;
    mapping(address => uint256) public balanceOf;

    constructor(IERC20 lpToken_, MockERC20 rewardToken_) {
        lpToken = lpToken_;
        rewardToken = rewardToken_;
    }

    function deposit(uint256 amount) external {
        lpToken.safeTransferFrom(msg.sender, address(this), amount);
        balanceOf[msg.sender] += amount;
    }

    function withdraw(uint256 amount) external {
        uint256 balance = balanceOf[msg.sender];
        require(balance >= amount, "GAUGE_BALANCE");
        balanceOf[msg.sender] = balance - amount;
        lpToken.safeTransfer(msg.sender, amount);
    }

    function getReward(address account) external {
        uint256 reward = rewardToken.balanceOf(address(this));
        if (reward != 0) IERC20(address(rewardToken)).safeTransfer(account, reward);
    }

    function fund(uint256 amount) external {
        rewardToken.mint(address(this), amount);
    }
}
