# One-click WETH -> USDC -> Aave entry

This uses EIP-7702. The user keeps the same EOA address and submits one type-4 transaction from that EOA to itself. The transaction authorizes a stateless implementation contract as the EOA's code, then calls `enterWethUsdcAave(...)` on the EOA address.

Inside that one transaction, the EOA:

1. Approves its WETH to the Uniswap V3 `SwapRouter`.
2. Swaps the full WETH balance to USDC with `exactInputSingle`.
3. Reads the current Aave V3 Pool from the Ethereum Core `PoolAddressesProvider`.
4. Approves exactly the returned USDC amount to that Pool.
5. Calls `Pool.supply(USDC, amountOut, address(this), 0)`.

If any step reverts, the whole transaction reverts. There is no state where the swap succeeds but the Aave supply does not.

## Mainnet addresses

- WETH: `0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2`
- USDC: `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48`
- Uniswap V3 factory: `0x1F98431c8aD98523631AE4a59f267346ea31F984`
- Uniswap V3 `SwapRouter`: `0xE592427A0AEce92De3Edee1F18E0157C05861564`
- Aave V3 Ethereum Core `PoolAddressesProvider`: `0x2f39d218133AFaB8F2B819B1066c7E434Ad94E9e`
- Current Aave V3 Ethereum Core Pool, read from the provider at runtime: currently `0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2`

## Why this meets the constraints

- Same address: Aave receives `supply` from the user's existing EOA, and aUSDC is minted to that same address.
- No new wallet or fresh address: no per-user contract account is deployed and no funds move to a new owner. The EOA gets EIP-7702 delegated code.
- No prior token approvals: approvals happen inside the same EOA transaction, before the swap and supply.
- Single atomic on-chain action: the swap and supply execute in one transaction from the EOA to itself.
- Unknown swap output is handled on-chain: the implementation uses the return value from Uniswap and supplies that exact amount to Aave.

## Running

Install dependencies:

```bash
npm install
```

Production should use a previously deployed and audited `WethUsdcAaveV3Entry7702` implementation and set:

```bash
RPC_URL=https://... \
PRIVATE_KEY=0x... \
ENTRY_IMPLEMENTATION_ADDRESS=0x... \
AMOUNT_OUT_MIN_USDC=6500 \
npm run entry
```

That prints a dry plan. To broadcast:

```bash
SEND_TRANSACTION=1 RPC_URL=https://... PRIVATE_KEY=0x... ENTRY_IMPLEMENTATION_ADDRESS=0x... AMOUNT_OUT_MIN_USDC=6500 npm run entry
```

For local setup testing only, `DEPLOY_ENTRY_IMPLEMENTATION=1` deploys the included stateless implementation bytecode first. That deployment is not the user's account; it is reusable application code. For a real one-click user flow, deploy and verify this implementation ahead of time.

## Implementation source

The bytecode embedded in `entry.ts` is compiled from this stateless implementation:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

interface IERC20 {
    function approve(address spender, uint256 amount) external returns (bool);
}

interface ISwapRouter {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }

    function exactInputSingle(ExactInputSingleParams calldata params) external payable returns (uint256 amountOut);
}

interface IPoolAddressesProvider {
    function getPool() external view returns (address);
}

interface IAaveV3Pool {
    function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external;
}

contract WethUsdcAaveV3Entry7702 {
    address public constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address public constant USDC = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;
    address public constant UNISWAP_V3_SWAP_ROUTER = 0xE592427A0AEce92De3Edee1F18E0157C05861564;
    address public constant AAVE_V3_POOL_ADDRESSES_PROVIDER = 0x2f39d218133AFaB8F2B819B1066c7E434Ad94E9e;

    error OnlySelf();
    error ZeroAmountIn();
    error ZeroAmountOut();
    error ApproveFailed(address token, address spender, uint256 amount);
    error PoolUnavailable();

    event Entered(address indexed account, uint256 wethIn, uint256 usdcOut, address indexed aavePool);

    function enterWethUsdcAave(
        uint256 amountIn,
        uint256 amountOutMinimum,
        uint24 uniswapFee,
        uint160 sqrtPriceLimitX96,
        uint256 deadline
    ) external payable returns (uint256 amountOut, address aavePool) {
        if (msg.sender != address(this)) revert OnlySelf();
        if (amountIn == 0) revert ZeroAmountIn();

        _forceApprove(WETH, UNISWAP_V3_SWAP_ROUTER, amountIn);

        amountOut = ISwapRouter(UNISWAP_V3_SWAP_ROUTER).exactInputSingle(
            ISwapRouter.ExactInputSingleParams({
                tokenIn: WETH,
                tokenOut: USDC,
                fee: uniswapFee,
                recipient: address(this),
                deadline: deadline,
                amountIn: amountIn,
                amountOutMinimum: amountOutMinimum,
                sqrtPriceLimitX96: sqrtPriceLimitX96
            })
        );

        if (amountOut == 0) revert ZeroAmountOut();

        aavePool = IPoolAddressesProvider(AAVE_V3_POOL_ADDRESSES_PROVIDER).getPool();
        if (aavePool == address(0)) revert PoolUnavailable();

        _forceApprove(USDC, aavePool, amountOut);
        IAaveV3Pool(aavePool).supply(USDC, amountOut, address(this), 0);

        emit Entered(address(this), amountIn, amountOut, aavePool);
    }

    function _forceApprove(address token, address spender, uint256 amount) private {
        _approve(token, spender, 0);
        _approve(token, spender, amount);
    }

    function _approve(address token, address spender, uint256 amount) private {
        (bool success, bytes memory data) = token.call(abi.encodeCall(IERC20.approve, (spender, amount)));
        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
            revert ApproveFailed(token, spender, amount);
        }
    }
}
```

## Safety requirements

- Set `AMOUNT_OUT_MIN_USDC` from a fresh quote. Do not run with a stale or loose minimum; the transaction can otherwise accept a bad price.
- Use the correct Uniswap fee tier. The script defaults to `500` for WETH/USDC and verifies the pool exists.
- Confirm the EIP-7702 implementation bytecode and source before allowing real users to authorize it. Delegated code can act from the user's EOA.
- The implementation has `msg.sender == address(this)` protection so arbitrary callers cannot invoke it through the delegated EOA; preserve that guard.
- EIP-7702 delegation persists until changed. If the product wants a one-shot posture, send a follow-up revocation transaction after entry or use wallet-managed delegation controls.
- Test against a mainnet fork with the exact calldata, slippage, and account state before mainnet.
