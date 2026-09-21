# USDC → WETH on Base: notes

## Approach

`swap.ts` runs these steps each time:

1. **Checks identity** (`sanityCheck`). It confirms chainId 8453. It checks that USDC and WETH return the expected `symbol()` and `decimals()`. It checks that each router and quoter reports the expected `factory()`, and that the Chainlink feed reports `"ETH / USD"`. If anything is off, it aborts before signing.
2. **Quotes every candidate pool at the full size of the trade (the "clip").** It does not quote 1 USDC and scale up; price impact only shows at real size. Candidates:
   - Aerodrome Slipstream USDC/WETH, tickSpacing 100 and 1
   - Uniswap v3 USDC/WETH, 0.05% and 0.30%
3. **Picks the pool with the most WETH out.**
4. **Compares against an outside price.** It works out fair WETH from Chainlink ETH/USD and aborts if the best quote is more than `MAX_ORACLE_DEV_BPS` (default 75 bps, fees included) below it. This catches a thin book, a pool that has been pushed off price, or LPs who have just pulled liquidity.
5. **Sets a hard floor on output.** `amountOutMinimum = quote × (1 − SLIPPAGE_BPS)`, default 20 bps. It re-quotes after the approve and uses the tighter of the two floors. It also sets a 120 s deadline.
6. **Approves the exact amount only** (no unlimited approval), simulates the swap, sends it, and reports WETH actually received vs the oracle.

It runs quote-only by default. Sending needs `EXECUTE=1` plus `PRIVATE_KEY`.

```bash
npm i
RPC_URL=<private Base RPC> AMOUNT_USDC=250000 npx tsx swap.ts
RPC_URL=<private Base RPC> AMOUNT_USDC=250000 PRIVATE_KEY=0x... EXECUTE=1 npx tsx swap.ts
```

## Venue: Aerodrome Slipstream, tickSpacing 100 (picked from live quotes)

Measured on Base mainnet on 2026-09-21 (block ~51.6M), quoting 500,000 USDC → WETH with each venue's own quoter. Chainlink fair value was ≈184.376 WETH (ETH ≈ $2,711.85).

| Pool | WETH out | vs Chainlink |
|---|---|---|
| **Slipstream USDC/WETH ts=100** (`0xb2cc…DC59`, fee 0.0639%) | **183.97** | **≈ −22 bps** |
| Uniswap v3 USDC/WETH 0.30% (`0x6c56…1372`) | 183.40 | ≈ −53 bps |
| Uniswap v3 USDC/WETH 0.05% (`0xd0b5…F224`) | 181.67–181.97 | ≈ −130 to −150 bps |
| Aerodrome v2 Router, vAMM USDC/WETH | 165.33 | ≈ −1,000 bps |
| Slipstream ts=1 | 48.1 | unusable at this size |

- On Base, the deepest USDC/WETH book is Aerodrome **Slipstream** (its concentrated-liquidity AMM). It is not Uniswap, and it is not Aerodrome's older v2-style `Router`. That Router **cannot reach Slipstream pools**: it only sees the vAMM pool, which was ~10% worse at this size. Both are real Aerodrome contracts, so a wrong choice here fails silently.
- **Rankings move within minutes.** Over ~30 min of runs, Slipstream ts=100 ranged from −12 to −195 bps. In one run, Uniswap v3 0.30% won (≈ −24 bps) and the script picked it. Concentrated-liquidity LPs move their ranges. That is why the script re-quotes every venue each run, and why the oracle guard exists. Nothing in the script assumes Slipstream wins.
- **Not covered:** Uniswap v4, other Slipstream factories (a second CL factory, `0xaDe6…716a`, has a USDC/WETH ts=50 pool holding only ~6.6k USDC), and splitting one order across pools. For the desk's sizes, compare the result against an aggregator quote (0x, 1inch, KyberSwap, Odos) that lists which pools it routes through. If the aggregator beats the best single pool by more than gas, route through it, or add split routing.

## Addresses (Base mainnet, chainId 8453)

Every address below was checked on-chain on 2026-09-21: code is present, and identity calls return the expected values.

| Role | Address | Check done |
|---|---|---|
| USDC (native Circle) | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | symbol USDC, 6 dec |
| WETH | `0x4200000000000000000000000000000000000006` | symbol WETH, 18 dec |
| Slipstream CLFactory | `0x5e7BB104d84c7CB9B682AaC2F3d509f5F406809A` | ts=100 pool's `factory()` |
| Slipstream SwapRouter | `0xBE6D8f0d05cC4be24d5167a3eF062215bE6D18a5` | `factory()` = above; `exactInputSingle` selector `0xa026383e` in bytecode |
| Slipstream QuoterV2 | `0x254cF9E1E6e233aa1AC962CB9B05b2cfeAaE15b0` | `factory()` = above |
| Slipstream USDC/WETH ts=100 pool | `0xb2cc224c1c9feE385f8ad6a55b4d94E92359DC59` | token0 WETH, token1 USDC, ts 100 |
| Uniswap v3 Factory (Base) | `0x33128a8fC17869897dcE68Ed026d694621f6FDfD` | |
| Uniswap SwapRouter02 (Base) | `0x2626664c2603336E57B271c5C0b26F421741e481` | `factory()` = above; `exactInputSingle` `0x04e45aaf` and `multicall(uint256,bytes[])` `0x5ae401dc` in bytecode |
| Uniswap QuoterV2 (Base) | `0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a` | `factory()` = above |
| Chainlink ETH/USD | `0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70` | description "ETH / USD", 8 dec |

Contract calls used:
- Slipstream `SwapRouter.exactInputSingle((tokenIn, tokenOut, int24 tickSpacing, recipient, deadline, amountIn, amountOutMinimum, sqrtPriceLimitX96))`
- Slipstream `QuoterV2.quoteExactInputSingle((tokenIn, tokenOut, amountIn, int24 tickSpacing, sqrtPriceLimitX96))`
- Uniswap `SwapRouter02.multicall(deadline, [exactInputSingle((tokenIn, tokenOut, uint24 fee, recipient, amountIn, amountOutMinimum, sqrtPriceLimitX96))])`. SwapRouter02's struct has no deadline field, so the deadline goes in `multicall`.
- Uniswap `QuoterV2.quoteExactInputSingle((tokenIn, tokenOut, amountIn, uint24 fee, sqrtPriceLimitX96))`
- ERC-20 `approve`, `allowance`, `balanceOf`; Chainlink `latestRoundData`

## What to get right before running with real funds

1. **Re-check every address above yourself** on basescan.org and against the protocols' own deployment lists (Aerodrome's `aerodrome-finance/slipstream` repo and docs, Uniswap's "Base deployments" docs page, Chainlink's Base data-feeds page). Do not rely on this file, and do not reuse Ethereum-mainnet addresses: Uniswap's Base router is a different address. `sanityCheck()` catches a wrong chain or a mismatched router/factory pair. It cannot tell a current deployment from a superseded one.
2. **Use native USDC (`0x8335…2913`), not USDbC (`0xd9aA…6CA`).** USDbC is the old bridged token: same ticker, different pools, much less liquidity. Make sure the desk's balance is actually native USDC.
3. **Use a private, paid RPC.** `mainnet.base.org` rate-limited this script during testing, which caused failed quotes and aborted runs. A dropped quote means that venue gets left out of the comparison.
4. **Think about MEV and routing.** Base's sequencer orders transactions first-come-first-served, with no public mempool, so sandwiching (a bot trading just before and after you) is less likely than on Ethereum L1, but not impossible. `amountOutMinimum` is your real protection. Keep `SLIPPAGE_BPS` tight (20 bps default), and never set the minimum to 0.
5. **Size vs depth.** At 500k USDC, the best pool cost about 22 bps including fees; the cost grows faster than size. For clips of several hundred thousand, the oracle guard (75 bps) will stop the trade when the book is thin. Do not respond by raising the limit. Split into tranches a few blocks apart, route through an aggregator, or use an RFQ/OTC desk. Check each size with a quote-only run first.
6. **The oracle guard assumes USDC = $1** and that the Chainlink answer is under 1 h old. If USDC loses its peg, the guard is wrong. Add the USDC/USD feed if that matters to you.
7. **Handle the key properly.** `PRIVATE_KEY` from an env var is fine for testing. For treasury funds, use a hardware wallet, KMS, or Safe signer (viem supports custom accounts). The script only ever gives the chosen router an allowance for the exact amount.
8. **Test on a fork first.** Run `anvil --fork-url <base rpc>`, fund a test account with USDC, and run with `EXECUTE=1` against it (steps below). Then do a small real trade (e.g. 100 USDC) before the full size.
9. **Check the receipt after sending.** The script prints WETH received and its bps vs the oracle; record both. If the `waitForTransactionReceipt` step times out, check the tx hash on basescan before re-running. Otherwise you risk swapping twice.

### Fork test used during development

```bash
anvil --fork-url <base rpc> --block-base-fee-per-gas 0 --port 8547
# fund anvil account #0: impersonate a USDC holder and transfer 500k.
# Do NOT take the USDC from a pool you are about to quote: that breaks its accounting and the quoter reverts.
RPC_URL=http://127.0.0.1:8547 AMOUNT_USDC=500000 EXECUTE=1 \
  PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 npx tsx swap.ts
```

Without `--block-base-fee-per-gas 0`, anvil's local base fee rose above the fee viem estimated from real Base, and the approve sat pending forever.

Result on the fork: the full flow completed via Uniswap v3 0.30% (approve → re-quote → swap, 183.40 WETH received, ≈ −24 bps vs oracle). **The Slipstream swap path was not executed end-to-end.** On the drpc-backed fork, Slipstream's quoter reverted. It quoted fine live on the same RPC, and on an earlier mainnet.base.org fork, but that fork was too rate-limited to finish sending the transactions. Its calldata is built against the verified router ABI (selector present in bytecode). Still: before the first real Slipstream trade, run the fork test (with a paid RPC) until it picks Slipstream and completes, or do a small real trade.
