// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {ERC20} from "../../src/lib/ERC20.sol";
import {IERC20} from "../../src/interfaces/IERC20.sol";
import {SafeTransferLib} from "../../src/lib/SafeTransferLib.sol";

contract MockAerodromePool is ERC20 {
    using SafeTransferLib for IERC20;

    address public immutable token0;
    address public immutable token1;
    address public router;
    uint256 public reserve0;
    uint256 public reserve1;
    uint256 public wethToUsdcNumerator;
    uint256 public wethToUsdcDenominator;

    constructor(address token0_, address token1_)
        ERC20("Mock USDC/WETH LP", "mLP", 6)
    {
        token0 = token0_;
        token1 = token1_;
        wethToUsdcNumerator = 2_000e6;
        wethToUsdcDenominator = 1e18;
    }

    modifier onlyRouter() {
        require(msg.sender == router, "ONLY_ROUTER");
        _;
    }

    function setRouter(address router_) external {
        require(router == address(0) || msg.sender == router, "ROUTER_SET");
        router = router_;
    }

    function setWethToUsdcRate(uint256 numerator, uint256 denominator) external {
        wethToUsdcNumerator = numerator;
        wethToUsdcDenominator = denominator;
    }

    function getReserves()
        external
        view
        returns (uint256 reserve0_, uint256 reserve1_, uint256 blockTimestampLast)
    {
        return (reserve0, reserve1, block.timestamp);
    }

    function getAmountOut(uint256 amountIn, address tokenIn) external view returns (uint256) {
        if (tokenIn == token1) return amountIn * wethToUsdcNumerator / wethToUsdcDenominator;
        if (tokenIn == token0) return amountIn * wethToUsdcDenominator / wethToUsdcNumerator;
        revert("BAD_TOKEN");
    }

    function mintLiquidity(address to, uint256 amount0, uint256 amount1)
        external
        onlyRouter
        returns (uint256 liquidity)
    {
        liquidity = amount0 + amount1 * wethToUsdcNumerator / wethToUsdcDenominator;
        reserve0 += amount0;
        reserve1 += amount1;
        _mint(to, liquidity);
    }

    function burnLiquidity(address to, uint256 liquidity)
        external
        onlyRouter
        returns (uint256 amount0, uint256 amount1)
    {
        uint256 supply = totalSupply;
        amount0 = reserve0 * liquidity / supply;
        amount1 = reserve1 * liquidity / supply;

        _burn(address(this), liquidity);
        reserve0 -= amount0;
        reserve1 -= amount1;

        IERC20(token0).safeTransfer(to, amount0);
        IERC20(token1).safeTransfer(to, amount1);
    }
}
