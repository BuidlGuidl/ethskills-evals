// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
}

interface ISwapRouter02 {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }
    function exactInputSingle(ExactInputSingleParams calldata params) external payable returns (uint256 amountOut);
}

interface IAavePool {
    function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external;
}

/// @title WethToAaveUsdc
/// @notice Stateless, ownerless helper: pulls `amountIn` WETH from the caller, swaps it to USDC on
///         Uniswap V3 (WETH/USDC 0.05% pool), and supplies exactly the USDC the swap returned to
///         Aave V3 on behalf of the caller. The caller receives the aUSDC; this contract never
///         holds funds or allowances between transactions.
/// @dev    It exists only because the supply amount is unknown until the swap executes; a plain
///         static call batch cannot pass the swap's return value into Aave's `supply`.
contract WethToAaveUsdc {
    address public constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address public constant USDC = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;
    address public constant SWAP_ROUTER_02 = 0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45;
    address public constant AAVE_V3_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;
    uint24 public constant POOL_FEE = 500;

    error Expired();
    error TransferFailed();

    event Entered(address indexed account, uint256 wethIn, uint256 usdcSupplied);

    function enter(uint256 amountIn, uint256 minUsdcOut, uint256 deadline) external returns (uint256 usdcOut) {
        if (block.timestamp > deadline) revert Expired();

        if (!IERC20(WETH).transferFrom(msg.sender, address(this), amountIn)) revert TransferFailed();
        if (!IERC20(WETH).approve(SWAP_ROUTER_02, amountIn)) revert TransferFailed();

        usdcOut = ISwapRouter02(SWAP_ROUTER_02).exactInputSingle(
            ISwapRouter02.ExactInputSingleParams({
                tokenIn: WETH,
                tokenOut: USDC,
                fee: POOL_FEE,
                recipient: address(this),
                amountIn: amountIn,
                amountOutMinimum: minUsdcOut,
                sqrtPriceLimitX96: 0
            })
        );

        // Exact approval; Aave pulls all of it, so the allowance returns to zero.
        if (!IERC20(USDC).approve(AAVE_V3_POOL, usdcOut)) revert TransferFailed();
        IAavePool(AAVE_V3_POOL).supply(USDC, usdcOut, msg.sender, 0);

        emit Entered(msg.sender, amountIn, usdcOut);
    }
}
