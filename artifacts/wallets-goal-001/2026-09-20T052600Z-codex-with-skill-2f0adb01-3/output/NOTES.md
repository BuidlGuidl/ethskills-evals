# One-click WETH -> USDC -> Aave V3 entry

This uses EIP-7702 on Ethereum mainnet. The user keeps the same EOA address, ENS name, and history. The position is created by one type-4 transaction sent from that same EOA to itself with an authorization list.

The EOA delegates execution to the mainnet ERC-7821 batcher at `0xe386b98Cd06c6aee22D66eDF97Df0476e3514222`, then runs two calls atomically:

1. `WETH.approve(oneClickHelper, amountIn)` from the EOA.
2. `oneClickHelper.enter(amountIn, minUsdcOut, poolFee)`.

The helper pulls the WETH, swaps exact input WETH to USDC through Uniswap V3 `SwapRouter02`, then supplies the exact USDC amount returned by the swap to Aave V3 `Pool.supply(..., onBehalfOf = user)`. If any step reverts, the whole transaction reverts, so there is no state where the swap succeeded but the Aave supply did not.

## Mainnet addresses

- WETH: `0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2`
- USDC: `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48`
- Uniswap V3 `SwapRouter02`: `0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45`
- Aave V3 Ethereum PoolAddressesProvider: `0x2f39d218133AFaB8F2B819B1066c7E434Ad94E9e`
- Aave V3 Ethereum Pool: `0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2`
- ERC-7821 EIP-7702 batcher: `0xe386b98Cd06c6aee22D66eDF97Df0476e3514222`

## Why this meets the constraints

- Same address: Aave receives `onBehalfOf = msg.sender`, where `msg.sender` is the original EOA under 7702 delegated execution, so aUSDC accrues to the user's existing address.
- No new wallet/account: the user does not create a smart wallet, Safe, proxy, or fresh address. The helper is an application contract, not a user account.
- No prior approvals: the WETH approval is the first call inside the same transaction.
- One atomic action: the approval and helper call are one ERC-7821 batch executed by the EOA. The helper's Uniswap swap and Aave supply happen in one call frame and revert together.
- Unknown output supported: the helper uses the `amountOut` returned by `SwapRouter02.exactInputSingle` as the amount passed to `AaveV3Pool.supply`.

## Running

Install runtime dependencies:

```bash
npm install viem tsx typescript
```

Deploy the stateless helper once, preferably from a deployer account rather than the user's wallet:

```bash
RPC_URL=https://... PRIVATE_KEY=0x... DEPLOY_HELPER=true npx tsx entry.ts
```

Then run the one-click entry transaction:

```bash
RPC_URL=https://... \
PRIVATE_KEY=0x... \
ONE_CLICK_HELPER=0xYourDeployedHelper \
MIN_USDC_OUT=6500 \
POOL_FEE=500 \
npx tsx entry.ts
```

`AMOUNT_WETH` defaults to `all`; set `AMOUNT_WETH=2` to force exactly 2 WETH. `MIN_USDC_OUT` is in human USDC units and must be chosen from a fresh quote with slippage protection.

## Safety checklist

- Do not hardcode or commit private keys or RPC URLs with embedded API keys.
- Verify the helper bytecode/source embedded in `entry.ts` and the ERC-7821 batcher before using real funds.
- Use a fresh Uniswap quote and a nonzero `MIN_USDC_OUT`; `0` makes the swap unsafe.
- Simulate on a mainnet fork first with the same helper address, amount, fee tier, and minimum output.
- Understand that EIP-7702 delegation can persist after the transaction. If the user wants no ongoing delegation, send a separate clearing authorization after entry.
- Keep `POOL_FEE=500` only if intentionally using the WETH/USDC 0.05% pool; otherwise set the desired Uniswap V3 fee tier.
