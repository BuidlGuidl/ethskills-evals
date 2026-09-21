# USDC → WETH on Base — notes

## Approach

`swap.ts` doesn't hardcode one venue. Every run it:

1. Checks chain ID is 8453 and that `symbol()` at the token addresses returns `USDC` / `WETH`.
2. Quotes each candidate USDC/WETH pool **at the real size**, one at a time. If any quote fails, the run stops: skipping a venue quietly could send size to a worse pool.
3. Picks the pool with the highest output.
4. **Price impact guard**: compares the real-size quote with a 1,000 USDC quote on the same pool, scaled up. Stops if the gap is > `MAX_IMPACT_BPS` (default 50).
5. **Min out** = live quote − `SLIPPAGE_BPS` (default 30). This goes on-chain as `amountOutMinimum`, so the swap reverts instead of filling worse.
6. **Oracle guard**: min out must be within `MAX_ORACLE_DEV_BPS` (default 100) of the Chainlink ETH/USD fair value. The oracle must be updated within the last hour. This catches a pool that is off-market or pushed around at quote time — a check the pool's own quote can't do on itself.
7. Dry run stops here. With `--execute`: approves the **exact** amount (no unlimited approval) to the chosen router, simulates, sends with a 120s deadline, waits for the receipt, and reports the WETH actually received plus the effective price.

```bash
npm install
PRIVATE_KEY=0x... BASE_RPC_URL=<private rpc> AMOUNT_USDC=500000 npx tsx swap.ts            # dry run
PRIVATE_KEY=0x... BASE_RPC_URL=<private rpc> AMOUNT_USDC=500000 npx tsx swap.ts --execute  # sends
```

## Venue choice: Aerodrome Slipstream and Uniswap v3, best quote wins

On Base, USDC/WETH depth sits in **concentrated-liquidity** pools (liquidity packed around the current price). Quotes I measured on 2026-09-21 (Base block ~51.6M, ETH ≈ $2,723):

| Venue (pool) | 500k USDC → WETH | vs Chainlink fair (183.61) |
|---|---|---|
| Aerodrome Slipstream, tickSpacing 100 (fee 0.0549%) | 183.48 | ≈ −7 bps |
| Uniswap v3 0.30% | 183.09 | ≈ −28 bps |
| Uniswap v3 0.05% | 181.24 | ≈ −129 bps |
| Uniswap v4 ETH/USDC 0.30% (quoted, not wired in) | 169.79 | ≈ −750 bps |
| Aerodrome v2 vAMM via `Router` 0xcF77… | 165.01 | ≈ −1,000 bps |
| Aerodrome Slipstream, tickSpacing 1 | 48.06 | pool is shallow |

At **250k** the ranking flipped: Uniswap v3 0.30% (91.56) beat Slipstream ts=100 (91.38). The best venue depends on size and moves from block to block. That's why the script quotes every run instead of fixing one venue.

Two traps worth naming:
- **Aerodrome has two AMMs.** The well-known v2 `Router` (`0xcF77…4E43`) only reaches the vAMM/sAMM pools. It's a real Aerodrome contract and the call goes through, but at 500k it filled ~10% worse. The deep book is in **Slipstream**, which has its own router and quoter, and its pools are keyed by `tickSpacing`, not `fee`.
- **Uniswap addresses on Base are not the Ethereum mainnet ones.** SwapRouter02 on Base is `0x2626…e481`, not mainnet's `0x68b3…Fc45`.

Not included: Uniswap v4 (quoted, too shallow for this pair at this size today), a second Slipstream factory `0xaDe6…716a` (has a ts=50 USDC/WETH pool with only ~6.6k USDC in it), and aggregators (below).

## Addresses (Base, chainId 8453) — checked on-chain 2026-09-21

| Role | Address | How it was checked |
|---|---|---|
| USDC (native, Circle) | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | `symbol()`=USDC, 6 decimals |
| WETH | `0x4200000000000000000000000000000000000006` | `symbol()`=WETH, 18 decimals |
| Slipstream SwapRouter | `0xBE6D8f0d05cC4be24d5167a3eF062215bE6D18a5` | `factory()` = CLFactory `0x5e7BB104d84c7CB9B682AaC2F3d509f5F406809A`, `WETH9()` = WETH |
| Slipstream QuoterV2 | `0x254cF9E1E6e233aa1AC962CB9B05b2cfeAaE15b0` | `factory()` = same CLFactory |
| Slipstream USDC/WETH ts=100 pool | `0xb2cc224c1c9feE385f8ad6a55b4d94E92359DC59` | `CLFactory.getPool(USDC,WETH,100)`, ~7.4M USDC held |
| Uniswap v3 SwapRouter02 | `0x2626664c2603336E57B271c5C0b26F421741e481` | `factory()` = `0x33128a8fC17869897dcE68Ed026d694621f6FDfD` |
| Uniswap v3 QuoterV2 | `0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a` | `factory()` = same |
| Chainlink ETH/USD | `0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70` | `description()`="ETH / USD", 8 decimals |

**Not** to be used: USDbC `0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA`. It's the old bridged USDC: same ticker in many UIs, different token, different liquidity.

Contract calls the script relies on:
- `SlipstreamQuoterV2.quoteExactInputSingle((tokenIn, tokenOut, amountIn, int24 tickSpacing, sqrtPriceLimitX96))`
- `UniV3QuoterV2.quoteExactInputSingle((tokenIn, tokenOut, amountIn, uint24 fee, sqrtPriceLimitX96))`
- `SlipstreamRouter.exactInputSingle((tokenIn, tokenOut, tickSpacing, recipient, deadline, amountIn, amountOutMinimum, sqrtPriceLimitX96))`
- `SwapRouter02.multicall(deadline, [exactInputSingle((tokenIn, tokenOut, fee, recipient, amountIn, amountOutMinimum, sqrtPriceLimitX96))])`. SwapRouter02's struct has no deadline, so the swap is wrapped in `multicall` to get one.
- `USDC.approve / allowance / balanceOf`, `ChainlinkFeed.latestRoundData()`

## What the developer must get right before real funds

1. **Re-check every address above on Base on the day you go live.** Run `cast code` and the identity call from the table, then match against Aerodrome's and Uniswap's own deployment lists and Basescan. The script checks the token symbols and chain ID at runtime, but not the router/quoter identity. A wrong router doesn't revert — it takes the approved USDC.
2. **Re-check the venue list.** Liquidity moves. Before each campaign, re-quote your real size across Slipstream tick spacings, Uniswap v3 fee tiers, and v4. Add or remove entries in `VENUES` to match. The script only picks the best of what's listed.
3. **Use a dedicated RPC** (Alchemy/QuickNode/your own node). The public `mainnet.base.org` rate-limited the quote loop in testing. The script now stops instead of routing on partial data, but you still want a reliable endpoint. Base has a single sequencer and no public mempool, so classic front-running is limited. Still, **`amountOutMinimum` is what actually protects you. Never set it to 0.**
4. **Pick your thresholds on purpose.** `SLIPPAGE_BPS=30`, `MAX_IMPACT_BPS=50`, `MAX_ORACLE_DEV_BPS=100` are starting points. Tighten them for a desk. Note the oracle check includes pool fees and impact, so 100 bps is loose.
5. **Split big orders.** One 500k clip cost ~7 bps today. At 1M+ the cost grows faster than linearly. Run several smaller clips spaced a few blocks apart (arbitrage refills the pool between them), or split across Slipstream and Uniswap v3. The script trades one pool per run. Splitting within one run is not built in.
6. **Consider an aggregator for size** (0x, 1inch, Odos, KyberSwap, CoW on Base). They can split across pools in one transaction. If you use one, log which pools it routed through and keep the same `amountOutMinimum` and oracle checks. Also check the aggregator's router address the same way as above.
7. **Key handling.** `PRIVATE_KEY` from env is for testing only. For treasury funds, sign with a hardware wallet, KMS, or a Safe multisig (the viem `account` swaps out easily). Leftover approvals: the script approves exactly `amountIn`, which the swap uses up. Don't switch to unlimited approvals.
8. **Test first.** Fork Base with Anvil, fund the test account with USDC, run `--execute`, and check the reported effective price. Then do one small live run (e.g. 1k USDC) before full size.
9. **Oracle caveats.** On an L2 a stale Chainlink price can show up after a sequencer outage. The script rejects prices older than 1h. For stricter safety, also read the Chainlink L2 Sequencer Uptime Feed for Base (look up the address in Chainlink's docs and verify it on-chain) and stop if the sequencer was recently down.
10. **Gas**: the account needs a bit of ETH on Base for approve + swap (tiny amounts on Base).

## What was tested (2026-09-21)

- `npm run typecheck` passes (strict).
- Dry run against live Base mainnet (publicnode RPC) at 500k and 250k: all quotes, impact and oracle checks passed. Output is in the tables above.
- On an Anvil fork of Base: sent the exact router calls the script makes, using `cast`. Slipstream `exactInputSingle`, 500k USDC → 183.52 WETH, 256k gas. SwapRouter02 `multicall(deadline,[exactInputSingle])` on the 0.30% pool, 250k USDC → 91.45 WETH, 130k gas.
- **Not done:** the full `swap.ts --execute` run end to end on the fork. The fork's upstream (public `mainnet.base.org`) timed out while fetching state for the ts=1 pool quote. Do step 8 above with a paid RPC before live use.
