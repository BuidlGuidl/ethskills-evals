# One-click WETH -> USDC -> Aave V3 entry

This uses EIP-7702 on Ethereum mainnet. The user keeps the same EOA address, ENS name, nonce history, and asset history. The one user transaction sets that EOA to execute a small predeployed implementation, calls the EOA itself, swaps WETH to USDC on Uniswap V3, and supplies the exact USDC returned by the swap to Aave V3.

Why a delegate implementation is required:

- A plain EOA transaction cannot do multiple contract calls.
- A generic batch implementation can approve and swap, but it cannot pass the unknown swap return amount into Aave's `supply`.
- Aave V3 `supply(asset, amount, ...)` does not use `type(uint256).max` as "supply my full wallet balance"; the exact `amount` is transferred.
- The delegated implementation therefore does the dynamic part on-chain: it stores the `amountOut` returned by Uniswap and supplies exactly that amount.

## Mainnet contracts used

- WETH: `0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2`
- USDC: `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48`
- Uniswap V3 `SwapRouter`: `0xE592427A0AEce92De3Edee1F18E0157C05861564`
- Aave V3 Ethereum Core `Pool`: `0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2`
- Aave V3 Ethereum Core `PoolAddressesProvider`: `0x2f39d218133AFaB8F2B819B1066c7E434Ad94E9e`

`entry.ts` preflights that the Aave provider still returns the Pool address above.

## Running

Install dependencies, then predeploy the implementation once from an app/developer wallet:

```bash
npm install
MAINNET_RPC_URL=... PRIVATE_KEY=... npm run entry -- --deploy-delegate
```

For the user entry transaction:

```bash
MAINNET_RPC_URL=... \
PRIVATE_KEY=... \
DELEGATE_IMPLEMENTATION=0x... \
MIN_USDC_OUT=7800 \
SEND=true \
I_UNDERSTAND_THIS_USES_REAL_MAINNET_FUNDS=yes \
npm run entry
```

By default the script swaps the wallet's entire WETH balance. Set `WETH_AMOUNT=2` to force exactly 2 WETH. `UNISWAP_POOL_FEE` defaults to `500` for the WETH/USDC 0.05% pool. `MIN_USDC_OUT` is required and is denominated in whole USDC, not wei.

To remove a 7702 delegation after testing:

```bash
MAINNET_RPC_URL=... PRIVATE_KEY=... SEND=true npm run entry -- --clear-delegate
```

## Why it is atomic

The submitted transaction is a single EIP-7702 type-4 transaction with `authorizationList: [delegate]`, `to: userEOA`, and calldata for `enter(...)`. Inside the delegated execution:

1. The EOA approves the Uniswap V3 router for `amountIn` WETH.
2. The router executes `exactInputSingle(WETH -> USDC)`.
3. The returned `amountOut` is approved to the Aave V3 Pool.
4. The Pool executes `supply(USDC, amountOut, userEOA, 0)`.
5. Approvals are reset to zero by default.

If any step reverts, the whole transaction reverts. There is no successful state where the swap happened but the Aave supply did not.

## Safety requirements

The delegated implementation becomes code for the user's EOA until the user replaces or clears the EIP-7702 delegation in a later transaction. Only delegate to code you have audited, pinned, and verified on-chain. Use `EXPECTED_DELEGATE_CODE_HASH` in production so the client refuses a wrong implementation. While delegated, calls made to the EOA itself run this implementation; this can change how arbitrary inbound calldata behaves compared with an empty-code EOA.

Never hardcode or commit a private key. The script uses `PRIVATE_KEY` only so a developer can run it; a real app should create a viem wallet client from the user's wallet provider and let MetaMask show the single confirmation.

The developer must set a sane `MIN_USDC_OUT` from a fresh quote and account for slippage, price movement, MEV, and the selected Uniswap fee tier. Test on a mainnet fork before submitting real funds.
