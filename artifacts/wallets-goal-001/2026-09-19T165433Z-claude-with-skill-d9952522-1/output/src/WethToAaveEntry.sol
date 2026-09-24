// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

interface IERC20 {
    function balanceOf(address) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
}

/// Uniswap V3 SwapRouter02 (no `deadline` field in the params struct).
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

/// @title WethToAaveEntry
/// @notice EIP-7702 delegate code for an existing EOA. Once the EOA delegates to
///         this contract, a transaction the EOA sends *to itself* calling
///         `enter` swaps WETH -> USDC on Uniswap V3 and supplies exactly the USDC
///         the swap returned to Aave V3, on behalf of the EOA, atomically.
/// @dev    Deliberately stateless: no storage, no owner, no initializer, no
///         upgrade path. Under 7702 the code runs in the EOA's context, so
///         address(this) IS the user's address and all balances/aTokens stay there.
///         Every state-changing entry point requires msg.sender == address(this),
///         which is only true when the EOA's own key signed the transaction.
contract WethToAaveEntry {
    address internal constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address internal constant USDC = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;
    address internal constant SWAP_ROUTER_02 = 0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45;
    address internal constant AAVE_V3_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;

    error OnlySelf();
    error Expired();
    error ZeroAmount();
    error ApproveFailed();
    error AllowanceLeft();

    event Entered(uint256 wethIn, uint256 usdcSupplied, uint24 fee);

    /// @param wethIn        exact WETH to swap (the user's whole balance, chosen off-chain and shown at the gate)
    /// @param minUsdcOut    slippage floor; the swap reverts (and so does everything) below it
    /// @param fee           Uniswap V3 pool fee tier (500 = 0.05% is the deep WETH/USDC pool)
    /// @param deadline      unix time after which the transaction is refused
    /// @return usdcSupplied the USDC the swap actually returned, all of which was supplied
    function enter(uint256 wethIn, uint256 minUsdcOut, uint24 fee, uint256 deadline)
        external
        returns (uint256 usdcSupplied)
    {
        if (msg.sender != address(this)) revert OnlySelf();
        if (block.timestamp > deadline) revert Expired();
        if (wethIn == 0 || minUsdcOut == 0) revert ZeroAmount();

        // (a) swap. Exact approval, fully consumed by the exact-input swap.
        _approve(WETH, SWAP_ROUTER_02, wethIn);
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

        // (b) supply exactly what (a) returned -- a runtime value, not a pre-signed constant.
        //     Using the swap's return (not balanceOf) leaves any USDC the account
        //     already held untouched.
        _approve(USDC, AAVE_V3_POOL, usdcSupplied);
        IAaveV3Pool(AAVE_V3_POOL).supply(USDC, usdcSupplied, address(this), 0);

        // Leave no standing approvals behind.
        if (
            IERC20(WETH).allowance(address(this), SWAP_ROUTER_02) != 0
                || IERC20(USDC).allowance(address(this), AAVE_V3_POOL) != 0
        ) revert AllowanceLeft();

        emit Entered(wethIn, usdcSupplied, fee);
    }

    // While delegated the account has code, so it must keep accepting what a
    // plain EOA accepts: ETH, and ERC-721/1155 safe transfers.
    receive() external payable {}

    function onERC721Received(address, address, uint256, bytes calldata) external pure returns (bytes4) {
        return this.onERC721Received.selector;
    }

    function onERC1155Received(address, address, uint256, uint256, bytes calldata) external pure returns (bytes4) {
        return this.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(address, address, uint256[] calldata, uint256[] calldata, bytes calldata)
        external
        pure
        returns (bytes4)
    {
        return this.onERC1155BatchReceived.selector;
    }

    function supportsInterface(bytes4 id) external pure returns (bool) {
        return id == 0x01ffc9a7 /* ERC165 */ || id == 0x150b7a02 /* ERC721Receiver */ || id == 0x4e2312e0; /* ERC1155Receiver */
    }

    function _approve(address token, address spender, uint256 amount) private {
        (bool ok, bytes memory ret) = token.call(abi.encodeCall(IERC20.approve, (spender, amount)));
        if (!ok || (ret.length != 0 && !abi.decode(ret, (bool)))) revert ApproveFailed();
    }
}
