# USDC → WETH on Base — treasury swap tool

## Usage

```bash
npm install
# dry run: quotes every venue, picks one, prints minOut. Sends nothing.
RPC_URL=https://<your-base-node> PRIVATE_KEY=0x... npx tsx swap.ts --amount 250000
# execute, split into 5 tranches 2 min apart
RPC_URL=... PRIVATE_KEY=0x... npx tsx swap.ts --amount 500000 --tranches 5 --interval-s 120 --execute
```

| flag | default | meaning |
|---|---|---|
| `--amount` | required | total USDC (human units) |
| `--tranches` / `--interval-s` | 1 / 60 | split over time; each tranche re-quoted from scratch |
| `--slippage-bps` | 30 | allowed drop vs the live quote (capped at 200) |
| `--max-oracle-dev-bps` | 75 | worst allowed fill vs Chainlink ETH/USD, fee + price impact included |
| `--max-feed-age-s` | 3600 | reject stale Chainlink answers |
| `--deadline-s` | 90 | tx deadline |
| `--recipient` | signer | where the WETH goes |
| `--execute` | off | without it, nothing is sent |

## Approach

Each tranche:
1. **Check wiring on this chain.** chainId = 8453; USDC/WETH `symbol()`+`decimals()`; every router's and quoter's `factory()` equals the expected factory; every pool address equals what its factory's `getPool` returns. Any mismatch → abort.
2. **Quote the full tranche on every candidate pool** with each venue's own on-chain quoter (`quoteExactInputSingle`). Quotes happen at the real size, so price impact is included.
3. **Pick the most WETH out.**
4. **Price check vs Chainlink** (ETH/USD and USDC/USD on Base). If the best fill is worse than oracle by more than `--max-oracle-dev-bps`, abort. This catches a pool that is thin, manipulated, or just repriced. The quote can't catch this itself, because it reads the same pool it is checking.
5. **`amountOutMinimum` = max(quote − slippage, oracle floor).**
6. **Approve the exact amount** (never unlimited) → simulate → send → check receipt → report the actual WETH received and its bps vs the oracle.

Router calls used:
- Aerodrome Slipstream `SwapRouter.exactInputSingle((tokenIn,tokenOut,int24 tickSpacing,recipient,deadline,amountIn,amountOutMinimum,sqrtPriceLimitX96))`
- Uniswap `SwapRouter02.multicall(uint256 deadline, [exactInputSingle((tokenIn,tokenOut,uint24 fee,recipient,amountIn,amountOutMinimum,sqrtPriceLimitX96))])`. SwapRouter02's struct has no deadline field, so the deadline comes from the `multicall` wrapper.

## Venue choice: quote-driven, not fixed

I did not hard-code one "best" venue, because the numbers don't support one. Live quotes for a **500,000 USDC → WETH** clip on Base mainnet, 2026-09-21 (oracle ≈ 2,728 USDC/ETH):

| pool | 1st probe | ~1 h later |
|---|---|---|
| Aerodrome Slipstream ts=100 `0xb2cc…` | **182.89 WETH (best)** | 179.15 (−224 bps) |
| Uniswap v3 0.30% `0x6c56…` | 182.76 | **182.71 (best, −30 bps)** |
| Aerodrome Slipstream (g3) ts=50 `0x3FE0…` | 181.75 | 181.60 |
| Uniswap v3 0.05% `0xd0b5…` | 180.76 | 180.20 |

The best pool changed within an hour: concentrated-liquidity positions move, and Aerodrome's ts=100 pool uses a dynamic fee (I saw 0.0594% and then 0.0549%). So the only defensible choice is to quote every deep pool at the real size, right before sending. That is what the script does. At the time of writing the Uniswap v3 0.30% pool is the deepest at large size: it held a 5M USDC dry-run quote at −57 bps vs oracle. Aerodrome is often better at 100k and below.

Pools I measured and **left out** (useless at desk size): Aerodrome Slipstream ts=1/10/50/200/2000 (original factory), ts=1/10 (g3), the "gauge caps" factory's ts=50 pool (~$6k USDC), Uniswap v3 0.01%/1%, and Uniswap v4 native-ETH/USDC hookless pools (best was ~65 WETH for 500k). Aerodrome's vAMM `Router` (`0xcF77…`) is a separate AMM from Slipstream and wasn't a candidate. Re-run discovery occasionally: liquidity migrates, especially between Aerodrome's Slipstream generations.

**Splitting one clip across pools in the same transaction** would add only about **+9 bps** at 500k by my measurement (greedy split over the 4 pools: 182.93 vs 182.76 WETH). The script can't do this: the two routers are different contracts. Sending the legs as separate transactions doesn't work either, because arbitrage bots re-align the other pools between blocks. If those bps matter, use an aggregator (0x, 1inch, Odos, KyberSwap, Uniswap routing API) that splits atomically. Check which pools its route actually hits, and keep the same oracle `minOut` guard on its calldata. **Splitting over time** (`--tranches`) is what helps here: arbitrage refills the pools from outside liquidity between tranches.

## Addresses (Base 8453) — checked on-chain 2026-09-21

| what | address | how checked |
|---|---|---|
| USDC (native Circle) | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | `symbol()`=USDC, 6 dp. **Not** USDbC `0xd9aAEc86…` (old bridged version) |
| WETH | `0x4200000000000000000000000000000000000006` | OP-stack predeploy, `symbol()`=WETH |
| Aerodrome Slipstream factory / router / QuoterV2 (original) | `0x5e7BB104…809A` / `0xBE6D8f0d…18a5` / `0x254cF9E1…15b0` | Slipstream repo deployment list; router & quoter `factory()` match |
| Aerodrome Slipstream factory / router / Quoter ("Gauges V3", latest) | `0xf8f2eB49…61Ef` / `0x698Cb2b6…A92F` / `0x514c8B5f…9259` | same |
| Uniswap v3 factory / SwapRouter02 / QuoterV2 | `0x33128a8f…FDfD` / `0x2626664c…e481` / `0x3d4e44Eb…B76a` | `factory()` match; selectors present in bytecode |
| Chainlink ETH/USD, USDC/USD | `0x71041ddd…Bb70`, `0x7e860098…bc6B` | `description()` = "ETH / USD", "USDC / USD"; fresh answers |

Full addresses are in `swap.ts`.

Testing: `tsc` clean. Dry runs against Base mainnet. On an anvil fork of Base: a full 500k execution (fill equal to the quote; allowance back to 0 afterwards), a 2-tranche run, and direct calls to both Aerodrome routers with the same struct layout the script uses. The oracle guard aborts as it should when tightened.

## Must get right before real funds

1. **Re-check every address yourself** against Aerodrome's `slipstream` repo deployment list, Uniswap's Base deployments page, Chainlink's data feeds page, and Basescan. Don't trust this file or my check: I checked on one day, and Aerodrome has already shipped three Slipstream generations. The script's `verifyWiring()` catches addresses that don't match each other. It does **not** catch a whole set that has been superseded.
2. **Use a dedicated RPC** (your own node or a paid provider). The public endpoints rate-limited me hard. When a quote fails, the script logs it and skips that venue. With a flaky RPC you could quietly miss the best pool: the oracle guard still protects the price, but not the best execution.
3. **Dry-run first, same size, minutes before.** Read the per-venue table. If the best fill is more than ~30–50 bps off the oracle, split with `--tranches`, not wider slippage.
4. **Guards are tuned for 100k–1M clips.** 30 bps slippage and 75 bps max oracle deviation. Chainlink ETH/USD on Base updates on a deviation threshold plus a heartbeat, so it can lag the market by some bps in fast markets. Don't raise `--max-oracle-dev-bps` to "make it go through". A failure there means the market is thin or moving.
5. **Use a dedicated hot wallet** holding only what's being swapped. Better: a Safe with this logic as a proposed transaction. A raw `PRIVATE_KEY` in env is the weak point for a treasury. Approvals are exact-amount, so no standing allowance is left behind.
6. **Keep ETH for gas on Base** in the signer. Costs are small, but zero means the approve lands and the swap doesn't.
7. **Tranches aren't atomic.** If tranche 3 aborts, tranches 1–2 have already filled. The logs show each tx hash and fill.
8. **The recipient gets WETH, not ETH.** If the desk wants native ETH, unwrap afterwards (`WETH.withdraw`), or add `unwrapWETH9` to the Uniswap multicall.
9. **USDC is a centrally controlled token** (blocklist/pause). A blocklisted sender or recipient makes the swap revert. It won't lose funds.
10. **Base sequencer ordering.** Base has no public mempool, so classic sandwiches are hard, but ordering is still not guaranteed. `minOut` and the deadline are your protection. Keep them tight.
