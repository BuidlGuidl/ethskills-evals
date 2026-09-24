// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
}

/// Uniswap SwapRouter02 (no `deadline` field in the struct).
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

interface IAaveV3Pool {
    function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external;
}

/// @notice Stateless, ownerless helper: pulls WETH from the caller, swaps it to USDC on
/// Uniswap V3 and supplies exactly the USDC the swap returned to Aave V3 on behalf of
/// the caller. It never holds funds between transactions and has no admin functions.
///
/// It exists only to bridge the one thing a static call batch cannot express: using the
/// swap's *runtime* output as the supply amount.
contract WethToAaveUsdc {
    address public constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address public constant USDC = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;
    ISwapRouter02 public constant SWAP_ROUTER = ISwapRouter02(0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45);
    IAaveV3Pool public constant AAVE_POOL = IAaveV3Pool(0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2);

    event Entered(address indexed account, uint256 wethIn, uint256 usdcSupplied);

    error Expired();
    error TransferFailed();

    /// @param amountIn     WETH to pull from msg.sender (caller must have approved this helper).
    /// @param fee          Uniswap V3 pool fee tier (e.g. 500 for the 0.05% WETH/USDC pool).
    /// @param minUsdcOut   Slippage floor; the swap (and therefore the whole tx) reverts below it.
    /// @param deadline     Unix timestamp after which the call reverts.
    /// @return usdcOut     USDC received from the swap and supplied to Aave.
    function swapAndSupply(uint256 amountIn, uint24 fee, uint256 minUsdcOut, uint256 deadline)
        external
        returns (uint256 usdcOut)
    {
        if (block.timestamp > deadline) revert Expired();

        // Funds only ever come from, and aTokens only ever go to, msg.sender — so nobody
        // can use this contract to spend someone else's approval.
        if (!IERC20(WETH).transferFrom(msg.sender, address(this), amountIn)) revert TransferFailed();
        if (!IERC20(WETH).approve(address(SWAP_ROUTER), amountIn)) revert TransferFailed();

        usdcOut = SWAP_ROUTER.exactInputSingle(
            ISwapRouter02.ExactInputSingleParams({
                tokenIn: WETH,
                tokenOut: USDC,
                fee: fee,
                recipient: address(this),
                amountIn: amountIn,
                amountOutMinimum: minUsdcOut,
                sqrtPriceLimitX96: 0
            })
        );

        // Exact approval; Aave pulls all of it, leaving the allowance at zero again.
        if (!IERC20(USDC).approve(address(AAVE_POOL), usdcOut)) revert TransferFailed();
        AAVE_POOL.supply(USDC, usdcOut, msg.sender, 0);

        emit Entered(msg.sender, amountIn, usdcOut);
    }
}
