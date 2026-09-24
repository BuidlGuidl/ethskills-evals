// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "../lib/ERC20.sol";
import {IERC20} from "../interfaces/IERC20.sol";
import {SafeERC20} from "../lib/SafeERC20.sol";

contract MockAerodromePool is ERC20 {
    using SafeERC20 for IERC20;

    address public immutable token0;
    address public immutable token1;
    address public router;

    constructor(address token0_, address token1_) ERC20("Mock USDC-WETH LP", "mLP", 18) {
        token0 = token0_;
        token1 = token1_;
        router = msg.sender;
    }

    modifier onlyRouter() {
        require(msg.sender == router, "POOL: router");
        _;
    }

    function setRouter(address router_) external onlyRouter {
        router = router_;
    }

    function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast) {
        reserve0 = uint112(IERC20(token0).balanceOf(address(this)));
        reserve1 = uint112(IERC20(token1).balanceOf(address(this)));
        blockTimestampLast = uint32(block.timestamp);
    }

    function mint(address to, uint256 liquidity) external onlyRouter {
        _mint(to, liquidity);
    }

    function burnTo(address to, uint256 liquidity) external onlyRouter returns (uint256 amount0, uint256 amount1) {
        uint256 supply = totalSupply;
        require(supply != 0, "POOL: no supply");

        amount0 = (IERC20(token0).balanceOf(address(this)) * liquidity) / supply;
        amount1 = (IERC20(token1).balanceOf(address(this)) * liquidity) / supply;

        _burn(msg.sender, liquidity);
        IERC20(token0).safeTransfer(to, amount0);
        IERC20(token1).safeTransfer(to, amount1);
    }
}

