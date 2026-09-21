// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IStrategy} from "../../src/interfaces/IStrategy.sol";

/// Holds USDC and optionally simulates an exit cost on withdraw.
contract MockStrategy is IStrategy {
    address public immutable vault;
    IERC20 public immutable usdc;
    uint256 public exitCostBps;
    address public constant SINK = address(0xdead);

    constructor(address vault_, IERC20 usdc_) {
        vault = vault_;
        usdc = usdc_;
    }

    function setExitCostBps(uint256 bps) external {
        exitCostBps = bps;
    }

    function totalAssets() external view returns (uint256) {
        return usdc.balanceOf(address(this));
    }

    function withdraw(uint256 amount) external returns (uint256 sent) {
        require(msg.sender == vault, "not vault");
        uint256 cost = amount * exitCostBps / 10_000;
        sent = amount - cost;
        usdc.transfer(SINK, cost);
        usdc.transfer(vault, sent);
    }
}
