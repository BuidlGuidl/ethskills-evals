# USDC → WETH on Base — treasury swap tool

## What it does

`swap.ts` swaps a given amount of native USDC into WETH on Base mainnet, from the signer's
own account to that same account.

For each clip (part of the order):

1. **Checks before trading:** chain id is 8453, every contract address has bytecode, the
   Chainlink L2 sequencer-uptime feed says Base is up (and has been for over 1 h), the ETH/USD
   feed is fresh, and the account has enough USDC and ETH for gas.
2. **Quotes every direct USDC/WETH pool** on the three deep onchain venues, at the exact clip size:
   - Uniswap V3 (fee tiers 0.01 / 0.05 / 0.3 / 1 %) via QuoterV2
   - Aerodrome Slipstream (concentrated liquidity, tick spacings 1 / 50 / 100 / 200 / 2000) via its QuoterV2
   - Aerodrome v2 volatile pool via `Router.getAmountsOut`
3. **Picks the best output** and compares it with a **fair price that doesn't come from the
   pools**: Chainlink ETH/USD (assuming 1 USDC = 1 USD). If the best quote is worse than the oracle by
   more than `MAX_ORACLE_DEVIATION_BPS` (default 50 bps, pool fee included), it **aborts**.
4. Sets `amountOutMinimum = max(quote − SLIPPAGE_BPS, oracle − MAX_ORACLE_DEVIATION_BPS)`.
   So the minimum is never looser than the oracle bound, even if the quote itself came from a
   manipulated pool state.
5. Approves **exactly** the clip amount to that one router (no unlimited approval), simulates
   the swap with `eth_call`, sends it, waits for the receipt, then checks the real balance changes
   (USDC spent == clip amount, WETH received ≥ minOut).
6. With `CLIPS > 1`, waits `CLIP_DELAY_SEC` so arbitrage bots can refill the pools, then re-quotes
   and repeats. Each clip can land on a different venue.

It's a **dry run by default** (prints quotes and the planned minimum only). You need `EXECUTE=true` to send anything.

```bash
npm install
RPC_URL=https://<your-base-rpc> PRIVATE_KEY=0x... AMOUNT_USDC=250000 CLIPS=5 npm run swap        # dry run
RPC_URL=...                     PRIVATE_KEY=0x... AMOUNT_USDC=250000 CLIPS=5 EXECUTE=true npm run swap
```

| Env | Default | Meaning |
|---|---|---|
| `RPC_URL` | required | Base RPC. Use a paid provider: the public `mainnet.base.org` hit rate limits during testing |
| `PRIVATE_KEY` | required | signer (see "before real funds") |
| `AMOUNT_USDC` | required | human units, e.g. `250000` |
| `CLIPS` | 1 | number of sequential clips |
| `CLIP_DELAY_SEC` | 30 | pause between clips |
| `SLIPPAGE_BPS` | 20 | tolerance vs the live quote (hard cap 100) |
| `MAX_ORACLE_DEVIATION_BPS` | 50 | max total cost vs Chainlink incl. fee + price impact (hard cap 300) |
| `MAX_ORACLE_AGE_SEC` | 1800 | reject a stale ETH/USD answer |
| `EXECUTE` | false | `true` to send transactions |

## Venue choice and why

**No single venue is hard-coded. The script chooses the best one at run time.** On Base, the
deepest USDC/WETH liquidity moves between Uniswap V3 and Aerodrome Slipstream as LPs move
their positions. Hard-coding one pool (or assuming "Aerodrome is always the biggest DEX on Base") means you
sometimes route $250k into the worse pool.

Live quotes I took for this work (Base mainnet, Chainlink ETH/USD = 2725.86):

| Venue / pool | 100k USDC | 250k USDC | 500k USDC |
|---|---|---|---|
| Uniswap V3 0.3 % | 2728.25 | 2728.56 | 2729.09 |
| Aerodrome Slipstream ts=100 | 2728.59 | 2729.45 | 2739.63 |
| Uniswap V3 0.05 % | 2734.70 | 2746.14 | 2767.98 |
| Aerodrome v2 volatile | 2788.50 | 2878.53 | 3028.57 |
| Uniswap V3 0.01 % / Slipstream ts=1 | >3300 | >5000 | >10000 |

(USD paid per ETH. Lower is better.) Notes:
- At these sizes, the two concentrated-liquidity pools, Uni V3 0.3 % and Slipstream ts=100, are
  far ahead. Low-fee pools look cheap on small trades but run out of liquidity after a few $10k.
  That's why the quote must be taken **at the full clip size**, not at a small probe size.
- Pool token balances are misleading (the Uni 0.3 % pool holds ~$100M USDC, but most of it is out of
  range). Only real quotes show the actual depth.
- The ranking changes over time. Re-check it on every run, which the script already does.

**Why direct pools instead of an aggregator (1inch/0x/Odos/Kyber) or intent/RFQ (CoW, UniswapX)?**
Aggregators can split one clip across several pools and can reach Uniswap V4 hooks-pools and
private market makers, so they will sometimes beat this script by a few bps. But they need an
off-chain API. The calldata comes from a third party, so for treasury use you'd have to decode and check
`to`/recipient/minOut before signing. This script is simple, has no API dependency, and every call
can be audited. **Recommended practice:** before a big order, compare this script's dry-run output
with an aggregator quote for the same size. If the aggregator is consistently better by more than gas + risk,
build a separate integration for it that keeps the same oracle-based minOut check.

**Not covered:** Uniswap V4 pools (native ETH/USDC on the V4 PoolManager, reached through the Universal
Router). They can hold real liquidity on Base, but encoding V4 swaps through the Universal Router is a
separate project. The oracle bound still protects you. You may just leave a few bps on the table.

## Contract addresses and calls used (Base, chainId 8453)

| What | Address | Calls |
|---|---|---|
| USDC (native Circle) | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | `balanceOf`, `allowance`, `approve` |
| WETH (predeploy) | `0x4200000000000000000000000000000000000006` | `balanceOf` |
| Uniswap V3 SwapRouter02 | `0x2626664c2603336E57B271c5C0b26F421741e481` | `multicall(uint256 deadline, bytes[])` wrapping `exactInputSingle((tokenIn,tokenOut,fee,recipient,amountIn,amountOutMinimum,sqrtPriceLimitX96))` |
| Uniswap V3 QuoterV2 | `0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a` | `quoteExactInputSingle((tokenIn,tokenOut,amountIn,fee,sqrtPriceLimitX96))` |
| Uniswap V3 Factory (checked only) | `0x33128a8fC17869897dcE68Ed026d694621f6FDfD` | — |
| Aerodrome Slipstream SwapRouter | `0xBE6D8f0d05cC4be24d5167a3eF062215bE6D18a5` | `exactInputSingle((tokenIn,tokenOut,tickSpacing,recipient,deadline,amountIn,amountOutMinimum,sqrtPriceLimitX96))` |
| Aerodrome Slipstream QuoterV2 | `0x254cF9E1E6e233aa1AC962CB9B05b2cfeAaE15b0` | `quoteExactInputSingle((tokenIn,tokenOut,amountIn,tickSpacing,sqrtPriceLimitX96))` |
| Aerodrome Slipstream CLFactory (checked only) | `0x5e7BB104d84c7CB9B682AaC2F3d509f5F406809A` | — |
| Aerodrome v2 Router | `0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43` | `getAmountsOut`, `swapExactTokensForTokens(amountIn, amountOutMin, Route[], to, deadline)` |
| Aerodrome v2 PoolFactory | `0x420DD381b31aEf6683db6B902084cB0FFECe40Da` | used inside `Route` |
| Chainlink ETH/USD | `0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70` | `latestRoundData`, `decimals` |
| Chainlink L2 Sequencer Uptime | `0xBCF85224fc0756B9Fa45aA7892530B47e10b6433` | `latestRoundData` |

How I verified them against Base mainnet:
- Every address has bytecode.
- `factory()` and `WETH9()` on both routers and both quoters return the expected factory and `0x4200…0006`.
- Each swap-function selector I encode (`04e45aaf`, `5ae401dc`, `a026383e`, `cac88ea9`, `5509a1ac`) is present in the router's bytecode.
- The Chainlink feeds' `description()` returns "ETH / USD" and "L2 Sequencer Uptime Status Feed".
- Full end-to-end run on an anvil fork of Base mainnet (below).

Watch out: **USDbC** (`0xd9aA…`, the old bridged USDC) is a different token. This tool only handles native USDC.

## Testing done

- `npm run typecheck` (strict TS): clean.
- Dry run against Base mainnet: quotes, oracle check, venue selection and minOut all correct.
- Anvil fork of Base mainnet, test account funded with USDC via storage write, `EXECUTE=true`:
  clip 1 went through the full flow on Uniswap V3 0.3 %. That covers the exact approval, simulation, swap,
  and the USDC-spent / WETH-received checks. Clip 2 correctly re-quoted and switched to Slipstream.
  The fork run then died because the free upstream RPC refused old-state requests. This was
  infrastructure, not the script. I didn't get a clean full multi-clip fork run.
- I checked all three swap encodings (Uni `multicall`+`exactInputSingle`, Slipstream
  `exactInputSingle`, Aero v2 `swapExactTokensForTokens`) with `eth_call` against live Base
  plus state overrides (fake USDC balance + allowance). Each returns ~18.3 WETH for 50k USDC, matching the
  quotes. That confirms the struct field order: a swapped `deadline`/`amountIn` would give a wildly
  different number.
- Before the first real run, redo a full fork run with a paid RPC as the upstream:
  `anvil --fork-url $RPC_URL`, then `RPC_URL=http://127.0.0.1:8545 ... EXECUTE=true npm run swap`.

## What to get right before running with real funds

1. **Signer.** Don't keep a treasury hot key in an env var. Swap `privateKeyToAccount` for a
   hardware/KMS/remote signer (viem supports custom accounts). Or, if the funds sit in a Safe, generate
   the same calldata and propose it as Safe transactions: `approve` + swap, ideally batched with MultiSend.
2. **Dry-run first, every time**, with the real size. Read the venue table and the bps vs oracle.
3. **Clip size.** Price impact grows faster than linearly with size. With the depth above, clips of ~50–100k keep
   impact around 10–20 bps. Use `CLIPS` so each clip passes the 50 bps oracle bound with margin,
   and leave `CLIP_DELAY_SEC` long enough (≥ 30 s, i.e. about 15 blocks) for arbitrage to re-align pools with CEX
   prices. Clipping over time exposes you to ETH price moves in the meantime. That's a desk decision.
4. **Tolerances.** `MAX_ORACLE_DEVIATION_BPS` has to cover pool fee (5–30 bps) + impact + oracle
   lag. The Chainlink feed only updates on a price deviation threshold or a heartbeat, so it can be a
   few tenths of a percent off during fast markets. Too tight → aborts (safe). Too loose → you
   accept a bad fill. Don't raise it to "make it go through"; lower the clip size instead.
5. **USDC = $1 assumption.** The fair price uses ETH/USD, not ETH/USDC. If USDC depegs, the check
   gets stricter and the script aborts (fails safe). It won't trade into a depeg.
6. **RPC.** Use a reliable, paid Base endpoint. Base has no public mempool (the sequencer orders transactions), so
   classic sandwich attacks are much harder than on L1. The oracle-based minOut is still what actually protects you.
7. **Gas.** Keep a small ETH balance for gas. Each clip = up to 2 txs (approve + swap).
8. **Re-verify addresses** against official deployment docs / BaseScan before the first real
   run. Also re-verify after any protocol upgrade announcement (e.g. a new Slipstream factory/router).
   A wrong router address can drain the approved amount.
9. **Start small on mainnet:** run a ~$100 swap with `EXECUTE=true`, check it on BaseScan, then scale up.
10. **Failure mode:** if the script aborts mid-order, the finished clips stay done and any
    leftover approval equals at most one clip's amount. Re-run with the remaining `AMOUNT_USDC`. Check and revoke
    leftover allowances if you're not continuing.
