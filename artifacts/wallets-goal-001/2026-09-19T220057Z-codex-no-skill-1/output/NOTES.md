# One-click WETH -> USDC -> Aave V3 entry

This tool uses EIP-7702 rather than a new smart wallet. The user's existing EOA signs a type-4 transaction that delegates to an already deployed implementation for this transaction path, then calls that implementation at the user's own address.

The important consequence is that `address(this)` during execution is the user's normal address: the same ENS-bearing EOA, the same on-chain history, and the same place where the Aave aUSDC position is minted.

## Why a purpose-built 7702 implementation is required

A static batch is not sufficient for this exact request.

The Uniswap V3 swap returns an amount of USDC that is only known at execution time. Aave V3 `Pool.supply(asset, amount, onBehalfOf, referralCode)` requires an exact `amount`; it does not treat `uint256.max` as "supply my full wallet balance." Therefore a generic `approve -> swap -> approve -> supply` multicall cannot supply "whatever the swap actually returned" unless it has custom logic that captures the swap return value or reads the USDC balance after the swap.

The EIP-7702 implementation expected by `entry.ts` must expose:

```solidity
function enterWethToAaveUsdc(EntryParams calldata params)
    external
    returns (uint256 usdcSupplied);
```

with behavior equivalent to:

1. Require `msg.sender == address(this)` so only the EOA itself can trigger the entry.
2. If `params.amountIn == type(uint256).max`, read `WETH.balanceOf(address(this))` and use the full runtime WETH balance.
3. Approve Uniswap `SwapRouter02` for exactly that WETH amount.
4. Call `SwapRouter02.exactInputSingle` for WETH -> USDC.
5. Use the returned `amountOut` as the exact Aave supply amount.
6. Approve Aave V3 Pool for exactly `amountOut`.
7. Call `Pool.supply(USDC, amountOut, address(this), referralCode)`.
8. Reset WETH and USDC approvals to zero.
9. Revert the whole call if any step fails.

That final revert behavior is what makes the position entry atomic: if Aave supply fails, the Uniswap swap is reverted too.

A minimal reference implementation for the delegated code is:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

interface IERC20 {
    function balanceOf(address owner) external view returns (uint256);
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

    function exactInputSingle(ExactInputSingleParams calldata params)
        external
        payable
        returns (uint256 amountOut);
}

interface IAaveV3Pool {
    function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode)
        external;
}

contract WethUsdcAaveEntry7702 {
    struct EntryParams {
        address weth;
        address usdc;
        address swapRouter02;
        address aavePool;
        uint24 fee;
        uint256 amountIn;
        uint256 minUsdcOut;
        uint160 sqrtPriceLimitX96;
        uint16 referralCode;
        uint256 deadline;
    }

    error OnlySelf();
    error Expired();
    error ZeroAmountIn();
    error ApproveFailed(address token, address spender, uint256 amount);

    function enterWethToAaveUsdc(EntryParams calldata p)
        external
        returns (uint256 usdcSupplied)
    {
        if (msg.sender != address(this)) revert OnlySelf();
        if (block.timestamp > p.deadline) revert Expired();

        uint256 amountIn = p.amountIn == type(uint256).max
            ? IERC20(p.weth).balanceOf(address(this))
            : p.amountIn;
        if (amountIn == 0) revert ZeroAmountIn();

        _approve(p.weth, p.swapRouter02, 0);
        _approve(p.weth, p.swapRouter02, amountIn);

        usdcSupplied = ISwapRouter02(p.swapRouter02).exactInputSingle(
            ISwapRouter02.ExactInputSingleParams({
                tokenIn: p.weth,
                tokenOut: p.usdc,
                fee: p.fee,
                recipient: address(this),
                amountIn: amountIn,
                amountOutMinimum: p.minUsdcOut,
                sqrtPriceLimitX96: p.sqrtPriceLimitX96
            })
        );

        _approve(p.weth, p.swapRouter02, 0);
        _approve(p.usdc, p.aavePool, 0);
        _approve(p.usdc, p.aavePool, usdcSupplied);
        IAaveV3Pool(p.aavePool).supply(
            p.usdc,
            usdcSupplied,
            address(this),
            p.referralCode
        );
        _approve(p.usdc, p.aavePool, 0);
    }

    function _approve(address token, address spender, uint256 amount) private {
        (bool ok, bytes memory ret) =
            token.call(abi.encodeCall(IERC20.approve, (spender, amount)));
        if (!ok || (ret.length != 0 && !abi.decode(ret, (bool)))) {
            revert ApproveFailed(token, spender, amount);
        }
    }
}
```

This source is a reference, not an audit. A production deployment should add whatever invariant checks, events, and verification process the integrator requires, then publish the verified bytecode address as `ENTRY_IMPLEMENTATION_ADDRESS`.

## Mainnet contracts used

- WETH: `0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2`
- USDC: `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48`
- Uniswap V3 Factory: `0x1F98431c8aD98523631AE4a59f267346ea31F984`
- Uniswap V3 SwapRouter02: `0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45`
- Uniswap V3 QuoterV2: `0x61fFE014bA17989E743c5F6cB21bF9697530B21e`
- Aave V3 Ethereum PoolAddressesProvider: `0x2f39d218133AFaB8F2B819B1066c7E434Ad94E9e`
- Aave V3 Ethereum Pool: `0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2`

`entry.ts` checks the current Aave Pool from the provider before sending. It also checks the selected Uniswap V3 WETH/USDC pool exists for `POOL_FEE` (default `500`, the 0.05% tier).

## Running

Install `viem` and run the script with a TypeScript runner such as `tsx`.

Required environment:

```bash
RPC_URL=https://...
PRIVATE_KEY=0x...
ENTRY_IMPLEMENTATION_ADDRESS=0x...
```

Optional environment:

```bash
POOL_FEE=500
SLIPPAGE_BPS=50
MIN_USDC_OUT=7300.00
WETH_AMOUNT=2.0
AAVE_REFERRAL_CODE=0
DEADLINE=1789850000
```

If `WETH_AMOUNT` is omitted, the script passes `uint256.max`, meaning the 7702 implementation must swap the full WETH balance at runtime. This is the right default for the requested "all 2 WETH" behavior.

If `MIN_USDC_OUT` is omitted, the script quotes Uniswap V3 QuoterV2 and applies `SLIPPAGE_BPS`. The developer must choose this carefully; a loose minimum invites bad execution, while a tight minimum may revert during normal price movement.

## Safety requirements

The developer must not point `ENTRY_IMPLEMENTATION_ADDRESS` at a generic batcher unless that batcher can dynamically use the swap output in the Aave supply call. A static batch can leave USDC unsupplied or require a guessed supply amount.

The implementation must be verified, audited, non-upgradeable or otherwise governed in a way the user explicitly accepts, and small enough to reason about. The EOA is delegating code to itself; malicious implementation code can move assets.

The implementation should approve exact amounts and reset approvals to zero. `entry.ts` refuses to run if it sees pre-existing WETH allowance to SwapRouter02 or USDC allowance to the Aave Pool, because the requested starting state is no approvals.

EIP-7702 preserves the user's address, but delegation persists until the user sends a later transaction that changes or clears it. That is still the same EOA, not a fresh smart wallet address, but the wallet UI should disclose the persistent delegation clearly.

The transaction must be sent by the same EOA that signs the 7702 authorization. `entry.ts` uses `executor: "self"` so the authorization nonce is scoped for self-execution.

Use a private RPC or other MEV-aware submission path for real value. The swap has slippage protection, but public mempool execution can still be sandwiched up to the configured minimum.
