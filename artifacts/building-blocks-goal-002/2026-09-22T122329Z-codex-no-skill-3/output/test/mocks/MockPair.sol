// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {MockERC20} from "./MockERC20.sol";

contract MockPair is MockERC20 {
    address public token0;
    address public token1;
    uint112 private reserve0;
    uint112 private reserve1;

    constructor(address token0_, address token1_) MockERC20("Aerodrome USDC-WETH LP", "vAMM-USDC/WETH", 18) {
        token0 = token0_;
        token1 = token1_;
    }

    function mintLiquidity(address to, uint256 amount0, uint256 amount1, uint256 liquidity) external {
        reserve0 += uint112(amount0);
        reserve1 += uint112(amount1);
        this.mint(to, liquidity);
    }

    function burnLiquidity(address from, address to, uint256 liquidity)
        external
        returns (uint256 amount0, uint256 amount1)
    {
        uint256 supply = totalSupply;
        require(supply > 0, "NO_SUPPLY");

        amount0 = (uint256(reserve0) * liquidity) / supply;
        amount1 = (uint256(reserve1) * liquidity) / supply;

        this.burn(from, liquidity);
        reserve0 -= uint112(amount0);
        reserve1 -= uint112(amount1);
        MockERC20(token0).transfer(to, amount0);
        MockERC20(token1).transfer(to, amount1);
    }

    function getReserves() external view returns (uint112, uint112, uint32) {
        return (reserve0, reserve1, uint32(block.timestamp));
    }
}

