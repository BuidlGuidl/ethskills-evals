# USDC → WETH on Base — treasury swap tool

## Run

```bash
npm i                     # viem, tsx
# dry run (quotes + oracle checks, no txs)
RPC_URL=https://<private-base-rpc> PRIVATE_KEY=0x... AMOUNT_USDC=250000 npx tsx swap.ts
# real
RPC_URL=... PRIVATE_KEY=0x... AMOUNT_USDC=250000 EXECUTE=1 npx tsx swap.ts
```

| env | default | meaning |
|---|---|---|
| `AMOUNT_USDC` | — | total size, human units (`250000`) |
| `TRANCHE_USDC` | `50000` | size of each child swap |
| `SLIPPAGE_BPS` | `15` | max drift between fresh quote and fill |
| `MAX_ORACLE_DEVIATION_BPS` | `60` | max total cost (fees + price impact) vs Chainlink; also the hard floor for `minOut` |
| `TRANCHE_DELAY_MS` | `6000` | pause between tranches (~3 Base blocks) so arbs re-align pools |
| `DEADLINE_SECS` | `60` | tx deadline |
| `EXECUTE` | unset | `1` sends txs; otherwise dry run |

## Approach

1. **Oracle guard first.** Read Chainlink sequencer uptime feed (abort if down or restarted <1h ago), ETH/USD and USDC/USD (abort if stale). This gives an independent "fair" WETH amount that doesn't come from the pools we're about to trade against.
2. **Quote every venue onchain** for each tranche: Uniswap V3 0.05% and 0.3%, Aerodrome Slipstream tick-spacing 100 and 1. Pick the best `amountOut`.
3. **Two-sided protection on `amountOutMinimum`:** `max(quote × (1 − SLIPPAGE_BPS), oracle × (1 − MAX_ORACLE_DEVIATION_BPS))`. The quote bound catches price moving between quote and inclusion; the oracle bound catches the case where the pool itself is already off-market (manipulated, drained, or oracle-vs-pool divergence). If the best quote is worse than the oracle bound, the script aborts instead of trading.
4. **Tranching.** Price impact on a CL pool grows faster than linearly with size. Splitting 250k into 5×50k with a pause lets arbitrageurs pull the pool back to market between fills, and each tranche is re-routed to whichever pool is best *at that moment* (liquidity moves between venues).
5. **Execution hygiene:** exact-amount approvals (never infinite), `eth_call` simulation before each send, deadline on every swap, and post-trade check that WETH balance actually increased by ≥ `minOut`.

Only single-hop USDC→WETH direct pools are used; no multi-hop, no native ETH.

## Venue choice and why

Snapshot on 2026-09-21 (Base block ~51.6M), from the script's own dry run. Oracle fair value for 250k USDC = 92.029 WETH (ETH/USD ≈ $2,712, USDC/USD ≈ 0.9998):

| venue (single shot, 250k USDC) | WETH out | cost vs oracle |
|---|---|---|
| Aerodrome Slipstream ts=100 (pool `0xb2cc…DC59`) | 91.986 | ~4 bps |
| Uniswap V3 0.3% (pool `0x6c56…1372`) | 91.638 | ~42 bps |
| Uniswap V3 0.05% (pool `0xd0b5…F224`) | 91.516 | ~55 bps |
| Aerodrome Slipstream ts=1 | 48.1 or no quote | thin; only for small sizes |
| Aerodrome V2 volatile (classic AMM, via `Router 0xcF77…4E43`) | 86.9 | ~560 bps — excluded |
| Uniswap V4 ETH/USDC 0.05% | 62.8 | excluded |

Oracle lag means "bps vs oracle" is noisy by ±10–20 bps (an earlier check the same day showed Slipstream ~30 bps under a slightly different oracle print). Relative ranking between venues is the reliable signal.

Fork test (anvil fork of Base mainnet, `EXECUTE=1`): 250k USDC → **92.0027 WETH** in 5×50k tranches, avg 2,717.31 USDC/WETH, ~2 bps under the starting oracle. 4 tranches routed to Slipstream, 1 to Uniswap V3 0.05% once Slipstream's price had moved. On a static fork there are no arbitrageurs refilling pools between tranches, so live results should be at least as good.

Conclusions:
- **No single pool dominates at this size.** Aerodrome Slipstream (the dominant DEX on Base) usually wins, but Uni V3 0.05%/0.3% are close and sometimes better. That is why the script quotes all of them per tranche rather than hardcoding one.
- **Aerodrome V2 (the classic `Router 0xcF77…4E43`) is not used** — the constant-product pool is far too shallow for this size.
- **Uniswap V4** is excluded: its ETH/USDC pool quoted badly for this size today, it outputs native ETH (needs wrapping), and the Universal Router command encoding adds risk for little gain. Re-check periodically.
- **Aggregators (1inch v6 `0x1111…2A65`, 0x, CoW, etc.)** can split one order across several pools atomically and will typically beat single-pool fills by several bps at this size. They need an API key, return opaque calldata that must be validated, and add a third-party dependency — a reasonable next step once the desk is comfortable. Consider CoW/RFQ (market makers) for 7-figure size; RFQ often beats AMMs outright.

## Addresses (Base, chainId 8453)

All checked onchain on 2026-09-21: bytecode present, routers/quoters report the expected `factory()`, feeds report expected `description()`.

| what | address |
|---|---|
| USDC (native Circle) | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| WETH | `0x4200000000000000000000000000000000000006` |
| Uniswap V3 SwapRouter02 | `0x2626664c2603336E57B271c5C0b26F421741e481` |
| Uniswap V3 QuoterV2 | `0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a` |
| Uniswap V3 Factory | `0x33128a8fC17869897dcE68Ed026d694621f6FDfD` |
| Aerodrome Slipstream SwapRouter | `0xBE6D8f0d05cC4be24d5167a3eF062215bE6D18a5` |
| Aerodrome Slipstream QuoterV2 | `0x254cF9E1E6e233aa1AC962CB9B05b2cfeAaE15b0` |
| Aerodrome Slipstream CLFactory | `0x5e7BB104d84c7CB9B682AaC2F3d509f5F406809A` |
| Chainlink ETH/USD | `0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70` |
| Chainlink USDC/USD | `0x7e860098F58bBFC8648a4311b374B1D669a2bc6B` |
| Chainlink L2 Sequencer Uptime | `0xBCF85224fc0756B9Fa45aA7892530B47e10b6433` |

Contract calls used:
- `QuoterV2.quoteExactInputSingle((tokenIn, tokenOut, amountIn, fee, sqrtPriceLimitX96))` — Uniswap
- `SwapRouter02.multicall(deadline, [exactInputSingle((tokenIn, tokenOut, fee, recipient, amountIn, amountOutMinimum, sqrtPriceLimitX96))])` — Base's SwapRouter02 struct has **no deadline field**; the deadline goes through `multicall(uint256,bytes[])`.
- `Slipstream QuoterV2.quoteExactInputSingle((tokenIn, tokenOut, amountIn, tickSpacing, sqrtPriceLimitX96))`
- `Slipstream SwapRouter.exactInputSingle((tokenIn, tokenOut, tickSpacing, recipient, deadline, amountIn, amountOutMinimum, sqrtPriceLimitX96))` — note `int24 tickSpacing`, not `uint24 fee`.
- `USDC.approve / allowance / balanceOf`, `WETH.balanceOf`, Chainlink `latestRoundData()`.

## What the developer must get right before using real funds

1. **Re-verify every address** on basescan.org yourself before the first real run. Wrong address = lost funds. Aerodrome has deployed newer Slipstream factories/routers; make sure the pools you trade are the ones with liquidity (see the balance/quote checks above) and that the router matches the pool's factory.
2. **Native USDC, not USDbC.** `0x8335…2913` is Circle's native USDC. The old bridged USDbC (`0xd9aA…6CA`) is a different token.
3. **Decimals.** USDC is 6 decimals, WETH 18, Chainlink feeds 8. `AMOUNT_USDC` is in human units; the script uses `parseUnits(…, 6)`.
4. **Never set `amountOutMinimum = 0`.** That's the single most common way large swaps get drained. Keep both the quote-based and oracle-based floors.
5. **Tune `MAX_ORACLE_DEVIATION_BPS` to the size.** 60 bps is fine for 50k tranches; a single-shot 250k fill measured 4–30 bps under the oracle depending on the oracle print. If it aborts, reduce tranche size or wait — don't just widen the limit.
6. **Oracle lag.** Chainlink ETH/USD on Base updates on a price-deviation threshold or a ~20 min heartbeat (check the current values on data.chain.link), so it can legitimately differ from pool price by tens of bps during fast moves. That's why the oracle bound is wider than the slippage bound. Don't make it tighter than ~0.5%.
7. **MEV.** Base has no public mempool (the sequencer orders txs), so classic sandwiching is much harder than on L1, but not impossible (priority-fee ordering, backrunning). The tight `minOut` is the real defense. Use a reliable private RPC (Alchemy/QuickNode/etc.); `mainnet.base.org` is rate-limited.
8. **Partial fills across tranches.** Tranches are separate txs. If the script aborts mid-way (oracle guard, revert, RPC error), you'll hold part WETH/part USDC. It prints what was filled; rerun with the remaining `AMOUNT_USDC`.
9. **Key management.** A raw `PRIVATE_KEY` env var is only acceptable for a hot wallet with limited balance. For desk funds, sign through a Safe multisig or HSM/KMS signer (viem supports custom accounts) — the logic here is unchanged, only `account` differs.
10. **Gas buffer.** The script adds 25% to `estimateGas`. Without it, a fork test tx ran out of gas at the pool's final reentrancy-lock write (`ReentrancySentryOOG`) *after* the swap math succeeded. Don't remove it.
11. **Approvals.** The script approves exactly the tranche amount per router. If a tx fails after approval, the leftover allowance stays; revoke if needed.
12. **Gas.** Account needs a little ETH on Base for gas (cents per tx).
13. **Dry run first, then a small real run** (e.g. `AMOUNT_USDC=100`) and inspect the txs on basescan before sending 6 figures.
14. **Test on a fork:** `anvil --fork-url <base-rpc>`, fund the default account with USDC via impersonation, and run with `EXECUTE=1`.
