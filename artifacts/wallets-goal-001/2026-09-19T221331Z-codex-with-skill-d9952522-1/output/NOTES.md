# One-Click WETH -> USDC -> Aave Entry

This uses EIP-7702 on Ethereum mainnet. The user keeps the same EOA address, ENS, nonce/history, and funds. No new smart wallet address is created, and no funds are moved to a fresh account.

The EOA signs one type-4 transaction that:

1. delegates the EOA to a small `WethUsdcAaveEntry` implementation contract,
2. calls `enter(...)` on the EOA itself,
3. from the EOA address, approves WETH to Uniswap V3 `SwapRouter02`,
4. swaps the full WETH balance to USDC,
5. reads the USDC balance increase from that swap,
6. approves exactly that USDC amount to Aave V3, and
7. supplies that USDC to Aave V3 on behalf of the same EOA.

If any step reverts, the swap and supply both revert. There is no half-done state where the swap succeeds and the Aave supply fails.

## Mainnet Addresses

- WETH: `0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2`
- USDC: `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48`
- Uniswap V3 `SwapRouter02`: `0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45`
- Uniswap V3 `QuoterV2`: `0x61fFE014bA17989E743c5F6cB21bF9697530B21e`
- Aave V3 Ethereum Pool: `0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2`
- Default WETH/USDC Uniswap V3 fee tier: `500` (0.05%)

Sources checked: Uniswap deployment docs, Aave address book, Circle USDC docs, WETH docs, EIP-7702, and viem EIP-7702 docs.

## Why Not Plain Multicall

A normal EOA cannot make multiple contract calls atomically in one transaction. A generic batch executor can make the calls, but it still cannot pass "whatever USDC the swap returned" into Aave unless code reads the balance after the swap. That dynamic amount is why `entry.ts` uses a purpose-built implementation contract rather than only calldata batching.

WETH also has no EIP-2612 permit, and the account starts with no approvals, so a permit-only flow cannot spend the user's WETH.

## Running

Install runtime dependencies in your project:

```bash
npm install viem solc tsx
```

Optional local compile check:

```bash
npx tsx entry.ts compile
```

One-time integrator setup:

```bash
RPC_URL=https://... PRIVATE_KEY=0x... npx tsx entry.ts deploy
```

Then run the user entry transaction:

```bash
RPC_URL=https://... \
PRIVATE_KEY=0x... \
IMPLEMENTATION_ADDRESS=0x... \
npx tsx entry.ts enter
```

Useful environment variables:

- `SLIPPAGE_BPS`: default `50` (0.50%).
- `MIN_USDC_OUT`: raw USDC units, overrides quoted slippage.
- `UNISWAP_V3_FEE`: default `500`.
- `CONFIRM=EXECUTE`: skip the interactive prompt for the entry transaction.
- `ALLOW_REDELEGATE=true`: allow replacing an existing EIP-7702 delegation.

To clear the EIP-7702 delegation afterward:

```bash
RPC_URL=https://... PRIVATE_KEY=0x... npx tsx entry.ts clear
```

## Safety Requirements

The implementation address is security-critical. Delegated code executes in the EOA's context, so the developer must verify the deployed bytecode matches the source in `entry.ts` and must not delegate to an arbitrary address.

EIP-7702 delegation persists after the entry transaction, even if the inner call reverts. The included implementation only lets the account call `enter` on itself, but the account will still have delegation code until `entry.ts clear` is run.

The human confirmation must show the account, implementation address, WETH amount, quoted USDC, minimum USDC, and maximum gas cost before signing. Do not hardcode, commit, or paste a real private key into source control.

Use a private RPC or other MEV-aware route for production. The minimum output protects the user from price movement, but public mempool execution can still be sandwiched up to that limit.
