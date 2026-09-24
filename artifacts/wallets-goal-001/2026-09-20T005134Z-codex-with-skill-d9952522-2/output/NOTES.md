# One-click WETH -> USDC -> Aave V3 entry

This uses EIP-7702. The existing EOA signs one authorization that designates already deployed code as the EOA's implementation, then the same transaction calls the EOA's own `enter` function. During execution `address(this)` is the user's original address, so the WETH approval, Uniswap swap, USDC approval, and Aave supply all happen from the same ENS/history-bearing account.

Why this shape is required:

- A normal EOA cannot make `approve -> swap -> supply` as one atomic on-chain action by itself.
- A generic batch executor is not enough, because Aave `supply` needs the exact USDC amount and that is only known after the Uniswap swap runs.
- The delegated implementation reads the EOA's USDC balance delta after the swap and supplies exactly that delta to Aave V3.

Mainnet contracts used:

- WETH: `0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2`
- USDC: `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48`
- Uniswap V3 `SwapRouter02`: `0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45`
- Uniswap V3 `QuoterV2`: `0x61fFE014bA17989E743c5F6cB21bF9697530B21e`
- Aave V3 Ethereum Core Pool: `0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2`

The transaction calls the delegated EOA at its own address with:

```solidity
enter(uint256 amountIn, uint256 minUsdcOut, uint24 fee, uint256 deadline)
```

Inside that single transaction the delegated code:

1. Requires `msg.sender == address(this)`, so another account cannot call the delegated EOA and move funds.
2. Approves `SwapRouter02` to spend exactly `amountIn` WETH.
3. Calls `SwapRouter02.exactInputSingle(WETH -> USDC, fee, recipient = address(this), amountIn, minUsdcOut, sqrtPriceLimitX96 = 0)`.
4. Clears the WETH router approval.
5. Computes `USDC.balanceOf(address(this)) - usdcBefore`.
6. Approves Aave V3 Pool to spend exactly that USDC delta.
7. Calls `AaveV3Pool.supply(USDC, usdcDelta, address(this), 0)`.
8. Clears the USDC Aave approval.

If any step fails, the whole transaction reverts. That means there is no successful state where the swap happened but the Aave supply did not.

## Running it

Install dependencies:

```bash
npm install
```

Deploy the stateless implementation once, from any funded deployer account:

```bash
MAINNET_RPC_URL=https://... \
PRIVATE_KEY=0x... \
DEPLOY_ENTRY_DELEGATE=true \
npm run entry
```

Record the printed `ENTRY_DELEGATE_IMPLEMENTATION` and `ENTRY_DELEGATE_CODE_HASH`. This deployment is infrastructure code, not a new user account, and user funds are never moved to it.

Then run the actual entry transaction from the user's EOA:

```bash
MAINNET_RPC_URL=https://... \
PRIVATE_KEY=0x... \
ENTRY_DELEGATE_IMPLEMENTATION=0x... \
ENTRY_DELEGATE_CODE_HASH=0x... \
MIN_USDC_OUT=3900 \
SEND_TRANSACTION=true \
npm run entry
```

By default the tool swaps the account's full WETH balance. Set `WETH_AMOUNT=2` to force exactly 2 WETH. `MIN_USDC_OUT` is in human USDC units; `MIN_USDC_OUT_RAW` can be used for 6-decimal base units.

## What must be right before mainnet use

- The delegated implementation must be reviewed and the code hash must match `ENTRY_DELEGATE_CODE_HASH`. A malicious implementation can move everything this EOA can move.
- `MIN_USDC_OUT` must be set from a fresh quote with an acceptable slippage bound. Do not set it to zero.
- The signer must be the user's existing EOA. Do not run this with a relayer unless the delegated code and authorization flow are changed deliberately.
- EIP-7702 delegation persists after the transaction. This implementation has a self-call guard, but the account will still show delegated code until the user sends a separate clearing authorization.
- The user needs enough ETH for gas. No ETH, WETH, or USDC is sent to a fresh address; Aave mints the aUSDC position to the same EOA.
