# One-click WETH -> USDC -> Aave entry

## Approach

This uses EIP-7702. The user's existing EOA signs an authorization that makes the EOA execute a small, already deployed implementation contract for this transaction. The transaction is sent to the user's own address and calls:

1. `WETH.approve(SwapRouter02, wethBalance)`
2. `SwapRouter02.exactInputSingle(WETH -> USDC, amountIn = wethBalance, recipient = the same EOA)`
3. `USDC.approve(AaveV3Pool, amountOut)`
4. `AaveV3Pool.supply(USDC, amountOut, onBehalfOf = the same EOA, referralCode = 0)`

The implementation reads the Uniswap return value inside the transaction and supplies exactly that USDC amount to Aave. If any step reverts, the whole transaction reverts, including approvals and the swap.

## Mainnet addresses used

- WETH: `0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2`
- USDC: `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48`
- Uniswap V3 `SwapRouter02`: `0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45`
- Aave V3 Ethereum Pool: `0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2`

References:

- Viem EIP-7702 docs: https://viem.sh/docs/eip7702
- Viem `signAuthorization`: https://viem.sh/docs/eip7702/signAuthorization
- Uniswap V3 Ethereum deployments: https://developers.uniswap.org/docs/protocols/v3/deployments/v3-ethereum-deployments
- Aave address book: https://github.com/aave-dao/aave-address-book
- Ethereum.org EIP-7702 overview: https://ethereum.org/roadmap/pectra/7702/

## Why this meets the constraints

The user keeps the same address. Aave receives `onBehalfOf = address(this)`, and under EIP-7702 execution `address(this)` is the user's EOA, so the aUSDC position belongs to the original ENS/history-bearing address.

No smart wallet or account is created for the user. A stateless implementation contract must exist somewhere on mainnet, but the user does not deploy a wallet, migrate funds, or move assets to a fresh address.

There is one atomic on-chain position-entry action. The approvals, swap, and Aave supply all happen in one transaction. There is no successful state where the swap happened but the Aave supply did not.

The supplied USDC amount does not need to be known before execution. The delegate code uses the `amountOut` returned by Uniswap's `exactInputSingle` call and passes that exact value into Aave `supply`.

## Running the tool

Install runtime dependencies in whatever project runs this file:

```bash
npm install viem tsx
```

Deploy the delegate implementation once:

```bash
MAINNET_RPC_URL=https://... \
PRIVATE_KEY=0x... \
DEPLOY_DELEGATE_IMPLEMENTATION=true \
npx tsx entry.ts
```

Then run the actual user entry transaction:

```bash
MAINNET_RPC_URL=https://... \
PRIVATE_KEY=0x... \
DELEGATE_IMPLEMENTATION=0x... \
MIN_USDC_OUT=6500 \
UNISWAP_POOL_FEE=500 \
npx tsx entry.ts
```

`MIN_USDC_OUT` is in whole USDC units and is parsed with 6 decimals. The default Uniswap fee tier is `500` (0.05%). Set `YES=true` only for non-interactive use after another review gate exists.

## Delegate implementation source

The bytecode embedded in `entry.ts` was compiled with Solidity `0.8.20`, optimizer enabled with 200 runs, from this source:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function approve(address spender, uint256 amount) external returns (bool);
    function balanceOf(address owner) external view returns (uint256);
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
    function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external;
}

contract WethToAaveUsdc7702 {
    error OnlySelf();
    error WrongChain();
    error ZeroAmountIn();
    error ZeroUsdcOut();
    error ApproveFailed(address token, address spender, uint256 amount);

    address internal constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address internal constant USDC = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;
    address internal constant SWAP_ROUTER_02 = 0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45;
    address internal constant AAVE_V3_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;

    modifier onlySelf() {
        if (msg.sender != address(this)) revert OnlySelf();
        _;
    }

    receive() external payable {}
    fallback() external payable {}

    function enter(uint256 amountIn, uint256 amountOutMinimum, uint24 uniswapPoolFee)
        external
        onlySelf
        returns (uint256 usdcSupplied)
    {
        if (block.chainid != 1) revert WrongChain();
        if (amountIn == 0) revert ZeroAmountIn();

        _forceApprove(WETH, SWAP_ROUTER_02, amountIn);
        uint256 amountOut = ISwapRouter02(SWAP_ROUTER_02).exactInputSingle(
            ISwapRouter02.ExactInputSingleParams({
                tokenIn: WETH,
                tokenOut: USDC,
                fee: uniswapPoolFee,
                recipient: address(this),
                amountIn: amountIn,
                amountOutMinimum: amountOutMinimum,
                sqrtPriceLimitX96: 0
            })
        );
        if (amountOut == 0) revert ZeroUsdcOut();

        _forceApprove(USDC, AAVE_V3_POOL, amountOut);
        IAaveV3Pool(AAVE_V3_POOL).supply(USDC, amountOut, address(this), 0);

        return amountOut;
    }

    function _forceApprove(address token, address spender, uint256 amount) private {
        _approve(token, spender, 0);
        _approve(token, spender, amount);
    }

    function _approve(address token, address spender, uint256 amount) private {
        (bool ok, bytes memory data) =
            token.call(abi.encodeCall(IERC20.approve, (spender, amount)));
        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) {
            revert ApproveFailed(token, spender, amount);
        }
    }
}
```

## Safety checklist

- Do not export a real user's MetaMask seed or private key into a server shell. `PRIVATE_KEY` makes this runnable for a funded developer account; a production app should create the same viem calls from a wallet client backed by the user's wallet/provider.
- Verify the delegate implementation source and bytecode before users authorize it. EIP-7702 delegates persist until cleared or replaced.
- Use a real quote and conservative `MIN_USDC_OUT`. A value of zero invites sandwich/price-impact loss.
- Simulate immediately before sending, as `entry.ts` does. Simulation is not a price guarantee; it only catches current-state failures.
- Keep exact approvals. The delegate approves exactly the WETH being swapped and exactly the USDC being supplied. If the transaction reverts, those approvals revert too.
- Consider `CLEAR_DELEGATION_AFTER=true` if the UX can tolerate a second cleanup transaction. It clears the 7702 delegation after the atomic entry transaction confirms.
- Never commit private keys, RPC secrets, or filled-in `.env` files.
