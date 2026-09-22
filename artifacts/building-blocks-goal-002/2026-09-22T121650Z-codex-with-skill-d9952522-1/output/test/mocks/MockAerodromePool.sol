// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { IAerodromePool } from "../../src/interfaces/IAerodrome.sol";
import { MockERC20 } from "./MockERC20.sol";

contract MockAerodromePool is MockERC20, IAerodromePool {
    address public immutable override token0;
    address public immutable override token1;
    bool public immutable override stable;

    uint256 public reserve0;
    uint256 public reserve1;

    constructor(address token0_, address token1_, bool stable_)
        MockERC20("Aerodrome WETH/USDC LP", "vAMM-WETH/USDC", 18)
    {
        token0 = token0_;
        token1 = token1_;
        stable = stable_;
    }

    function seed(uint256 wethReserve, uint256 usdcReserve, uint256 lpSupply) external {
        reserve0 = wethReserve;
        reserve1 = usdcReserve;
        this.mint(msg.sender, lpSupply);
    }

    function mintLp(address to, uint256 amount) external {
        this.mint(to, amount);
    }

    function burnLp(address from, uint256 amount) external {
        this.burn(from, amount);
    }

    function addReserves(uint256 wethAmount, uint256 usdcAmount) external {
        reserve0 += wethAmount;
        reserve1 += usdcAmount;
    }

    function removeReserves(uint256 wethAmount, uint256 usdcAmount) external {
        reserve0 -= wethAmount;
        reserve1 -= usdcAmount;
    }

    function getReserves()
        external
        view
        override
        returns (uint256 reserve0_, uint256 reserve1_, uint256 blockTimestampLast)
    {
        return (reserve0, reserve1, block.timestamp);
    }
}
