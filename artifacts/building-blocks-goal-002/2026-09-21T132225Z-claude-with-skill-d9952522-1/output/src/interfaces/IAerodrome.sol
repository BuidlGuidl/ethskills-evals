// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// Minimal Aerodrome (Base) interfaces. Signatures checked against deployed bytecode.
interface IAeroRouter {
    struct Route {
        address from;
        address to;
        bool stable;
        address factory;
    }

    function addLiquidity(
        address tokenA,
        address tokenB,
        bool stable,
        uint256 amountADesired,
        uint256 amountBDesired,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 deadline
    ) external returns (uint256 amountA, uint256 amountB, uint256 liquidity);

    function removeLiquidity(
        address tokenA,
        address tokenB,
        bool stable,
        uint256 liquidity,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 deadline
    ) external returns (uint256 amountA, uint256 amountB);

    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        Route[] calldata routes,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);
}

interface IAeroPool {
    function token0() external view returns (address);
    function token1() external view returns (address);
    function stable() external view returns (bool);
    function totalSupply() external view returns (uint256);
    function getReserves() external view returns (uint256 reserve0, uint256 reserve1, uint256 blockTimestampLast);
}

interface IAeroPoolFactory {
    function getFee(address pool, bool stable) external view returns (uint256);
}

interface IAeroGauge {
    function stakingToken() external view returns (address);
    function rewardToken() external view returns (address);
    function balanceOf(address account) external view returns (uint256);
    function earned(address account) external view returns (uint256);
    function deposit(uint256 amount) external;
    function withdraw(uint256 amount) external;
    function getReward(address account) external;
}

interface IAeroVoter {
    function isAlive(address gauge) external view returns (bool);
}
