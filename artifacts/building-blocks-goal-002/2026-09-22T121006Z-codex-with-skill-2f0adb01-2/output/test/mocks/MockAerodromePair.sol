// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {MinimalERC20} from "../../src/lib/MinimalERC20.sol";

contract MockAerodromePair is MinimalERC20 {
    address public immutable token0;
    address public immutable token1;
    uint256 private reserve0;
    uint256 private reserve1;

    constructor(address token0_, address token1_) MinimalERC20("Mock USDC/WETH LP", "mLP", 6) {
        token0 = token0_;
        token1 = token1_;
    }

    function getReserves() external view returns (uint256, uint256, uint256) {
        return (reserve0, reserve1, uint256(block.timestamp));
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external {
        _burn(from, amount);
    }

    function addReserves(uint256 amount0, uint256 amount1) external {
        reserve0 += amount0;
        reserve1 += amount1;
    }

    function removeReserves(uint256 amount0, uint256 amount1) external {
        reserve0 -= amount0;
        reserve1 -= amount1;
    }
}

