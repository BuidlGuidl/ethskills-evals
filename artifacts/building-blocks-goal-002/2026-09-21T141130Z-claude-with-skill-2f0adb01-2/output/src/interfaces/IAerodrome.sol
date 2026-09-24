// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Minimal Aerodrome (Aero) interfaces used by the vault. Signatures match
/// the deployed Base contracts (Router 0xcF77..4E43, Pool, Gauge, Voter).
interface IAeroRouter {
    struct Route {
        address from;
        address to;
        bool stable;
        address factory;
    }

    function defaultFactory() external view returns (address);

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

    function getAmountsOut(uint256 amountIn, Route[] calldata routes)
        external
        view
        returns (uint256[] memory amounts);
}

interface IAeroPool {
    function token0() external view returns (address);
    function token1() external view returns (address);
    function stable() external view returns (bool);
    function totalSupply() external view returns (uint256);
    function balanceOf(address) external view returns (uint256);
    function getReserves() external view returns (uint256 reserve0, uint256 reserve1, uint256 blockTimestampLast);
}

interface IAeroGauge {
    function stakingToken() external view returns (address);
    function rewardToken() external view returns (address);
    function balanceOf(address) external view returns (uint256);
    function earned(address account) external view returns (uint256);
    function deposit(uint256 amount) external;
    function withdraw(uint256 amount) external;
    function getReward(address account) external;
}

interface IAeroVoter {
    function gauges(address pool) external view returns (address);
    function isAlive(address gauge) external view returns (bool);
}
