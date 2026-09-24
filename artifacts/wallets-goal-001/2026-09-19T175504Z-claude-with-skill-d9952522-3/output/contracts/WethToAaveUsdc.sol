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

/// @notice Stateless, ownerless router: pulls WETH from the caller, swaps it to USDC on
///         Uniswap V3 and supplies exactly the USDC the swap returned to Aave V3 on the
///         caller's behalf. It holds nothing between transactions and has no admin.
///         The caller is both the source of funds and the beneficiary — there is no
///         parameter that can redirect either.
contract WethToAaveUsdc {
    address public constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address public constant USDC = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;
    address public constant SWAP_ROUTER_02 = 0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45;
    address public constant AAVE_V3_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;

    error Expired();
    error ZeroAmount();

    event Entered(address indexed account, uint256 wethIn, uint256 usdcSupplied);

    function enter(uint256 wethIn, uint256 minUsdcOut, uint24 fee, uint256 deadline)
        external
        returns (uint256 usdcSupplied)
    {
        if (block.timestamp > deadline) revert Expired();
        if (wethIn == 0 || minUsdcOut == 0) revert ZeroAmount();

        // WETH9 and USDC both revert on failure, so return values need no extra handling.
        IERC20(WETH).transferFrom(msg.sender, address(this), wethIn);
        IERC20(WETH).approve(SWAP_ROUTER_02, wethIn);

        usdcSupplied = ISwapRouter02(SWAP_ROUTER_02).exactInputSingle(
            ISwapRouter02.ExactInputSingleParams({
                tokenIn: WETH,
                tokenOut: USDC,
                fee: fee,
                recipient: address(this),
                amountIn: wethIn,
                amountOutMinimum: minUsdcOut,
                sqrtPriceLimitX96: 0
            })
        );

        // Supply exactly what the swap returned — the amount is only known here, at runtime.
        IERC20(USDC).approve(AAVE_V3_POOL, usdcSupplied);
        IAavePool(AAVE_V3_POOL).supply(USDC, usdcSupplied, msg.sender, 0);

        emit Entered(msg.sender, wethIn, usdcSupplied);
    }
}
