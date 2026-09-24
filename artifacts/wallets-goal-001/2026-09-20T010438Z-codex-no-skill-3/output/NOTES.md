# One-Click WETH -> USDC -> Aave V3 Entry

This uses EIP-7702. The transaction authorizes the user's existing EOA to execute the `WethUsdcAaveV3Entry7702` implementation code for the entry call, then sends one transaction to the user's own address.

Why EIP-7702 is needed: a normal EOA cannot put `approve`, `swap`, and `supply` into one top-level transaction by itself. A plain batch executor is also not enough here because the Aave `supply` amount is not known until Uniswap returns the actual USDC. The delegated implementation runs at the EOA's address, swaps the WETH, reads the USDC balance delta, and supplies exactly that delta to Aave.

## Mainnet Contracts

- WETH: `0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2`
- USDC: `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48`
- Uniswap V3 `SwapRouter`: `0xE592427A0AEce92De3Edee1F18E0157C05861564`
- Aave V3 Ethereum Core `Pool`: `0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2`

The entry implementation calls:

1. `WETH.approve(SwapRouter, amountIn)`
2. `SwapRouter.exactInputSingle(WETH -> USDC, recipient = address(this), amountIn, minUsdcOut)`
3. `USDC.balanceOf(address(this))` before and after the swap to compute the actual received USDC
4. `USDC.approve(AaveV3Pool, receivedUsdc)`
5. `AaveV3Pool.supply(USDC, receivedUsdc, address(this), 0)`

Under EIP-7702, `address(this)` is the user's EOA, not the implementation contract. The aUSDC position is therefore minted to the same address with the ENS name and history the user already has.

## Running

Install dependencies:

```sh
npm install
```

Production should deploy and verify `WethUsdcAaveV3Entry7702` once, then set:

```sh
RPC_URL=https://...
PRIVATE_KEY=0x...
ENTRY_IMPLEMENTATION_ADDRESS=0x...
MIN_USDC_OUT=6500
npm run entry
```

For development setup only, the script can deploy the implementation before the entry transaction:

```sh
DEPLOY_IMPLEMENTATION=true RPC_URL=https://... PRIVATE_KEY=0x... MIN_USDC_OUT=6500 npm run entry
```

That deployment is setup, not part of the user's one-confirmation entry flow.

## Safety Requirements

- Set `MIN_USDC_OUT` from a fresh quote and your slippage policy. If the swap returns less, the whole transaction reverts.
- Use the intended Uniswap V3 fee tier. The default is `500` for the WETH/USDC 0.05% pool.
- Verify the entry implementation bytecode/source before users authorize it. A 7702 delegation is security-critical because the implementation code executes from the EOA address.
- The implementation has `msg.sender == address(this)` protection, so other accounts cannot call the delegated `enter` function on the user's EOA.
- EIP-7702 delegation remains on the EOA until changed or cleared by another authorization. This does not create a fresh address or move funds to a new account, but developers should make that wallet-state change explicit to users and offer a clear reset flow.
- The transaction is atomic: if Uniswap fails, Aave supply fails, or the minimum output check fails, all approvals and intermediate balances revert with the transaction.
