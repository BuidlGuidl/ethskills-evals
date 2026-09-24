# USDC → WETH on Base: treasury swap notes

## TL;DR
- `swap.ts` gets on-chain quotes from the three deep USDC/WETH pools on Base, finds the **best split** of the order across them, checks the all-in price against **Chainlink**, then sends each leg with `amountOutMinimum` and a deadline.
- It is a **dry run by default**. Nothing is sent unless `EXECUTE=1` is set.
- Tested end to end on an anvil fork of Base mainnet (2026-09-21): 1M USDC split 10/25/65 across Uni 0.05% / Uni 0.3% / Aerodrome, fill = quote exactly.

```bash
npm install
RPC_URL=https://<your-base-rpc> AMOUNT_USDC=250000 npm run swap                                  # quote + plan only
RPC_URL=https://<your-base-rpc> AMOUNT_USDC=250000 PRIVATE_KEY=0x... EXECUTE=1 npm run swap      # real
```

| env | default | meaning |
|---|---|---|
| `RPC_URL` | required | Base mainnet RPC. Use a paid/private one; public ones rate-limit. |
| `AMOUNT_USDC` | required | Human units, e.g. `250000` |
| `PRIVATE_KEY` | – | Needed only with `EXECUTE=1` |
| `EXECUTE` | off | `1` = send txs |
| `RECIPIENT` | signer | Where WETH goes |
| `SLIPPAGE_BPS` | 30 | Max drop from quote to fill, per leg (sets `amountOutMinimum`) |
| `MAX_ORACLE_DEV_BPS` | 75 | Abort if all-in price (fees + price impact) is more than this worse than Chainlink |
| `SPLIT_STEPS` | 20 | How finely the split is searched (20 = 5% steps) |
| `CHUNKS` / `CHUNK_DELAY_SEC` | 1 / 60 | Split the order over time (TWAP-style) |
| `DEADLINE_SEC` | 120 | Tx deadline |

## Venue choice

Measured on Base mainnet on 2026-09-21 (Chainlink ETH ≈ $2716.45). Numbers are the average USDC paid per WETH:

| size | Uni V3 0.05% | Uni V3 0.3% | Aero Slipstream ts100 | Uni V4 ETH 0.05% | **split (script)** |
|---|---|---|---|---|---|
| 100k | 2726 | 2731 | **2720** | 3079 | ≈2720 |
| 300k | 2741 | 2732 | 2722 | 4657 | **2722.4** (10% Uni 0.05 / 90% Aero) |
| 1M | 2813 | 2734 | 2741 | 15216 | **2727.5** (≈22 bps better than best single pool, ~$2.2k) |

Takeaways:
- Base liquidity for this pair is split between **Aerodrome Slipstream** (the main Base DEX) and **Uniswap V3**. Which one is best depends on size, and at 6-figure sizes a split beats any single pool.
- The Uni V4 ETH/USDC pools look deep at small sizes but are thin further from the current price. They are left out, which also avoids the extra complexity of Universal Router + Permit2.
- Other Uni V3 fee tiers (0.01%, 1%) and other Aerodrome tick spacings hold very little at this size, so they are left out too.
- So the script uses **direct pool calls through the official routers, split across the 3 deep pools**. It has no aggregator API dependency, no off-chain calldata to trust, and every call can be checked.

### Contracts used (all verified on-chain: code present, routers/quoters point at the expected factories, function selectors present in bytecode)

| what | address | call |
|---|---|---|
| USDC (native Circle, **not** USDbC) | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | `approve`, `allowance`, `balanceOf` |
| WETH (OP predeploy) | `0x4200000000000000000000000000000000000006` | `balanceOf` |
| Uniswap V3 SwapRouter02 | `0x2626664c2603336E57B271c5C0b26F421741e481` | `multicall(uint256 deadline, bytes[])` wrapping `exactInputSingle((tokenIn,tokenOut,fee,recipient,amountIn,amountOutMinimum,sqrtPriceLimitX96))` |
| Uniswap V3 QuoterV2 | `0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a` | `quoteExactInputSingle((tokenIn,tokenOut,amountIn,fee,sqrtPriceLimitX96))` |
| Uniswap V3 Factory | `0x33128a8fC17869897dcE68Ed026d694621f6FDfD` | (reference) pools: 0.05% `0xd0b53D9277642d899DF5C87A3966A349A798F224`, 0.3% `0x6c561B446416E1A00E8E93E221854d6eA4171372` |
| Aerodrome Slipstream SwapRouter | `0xBE6D8f0d05cC4be24d5167a3eF062215bE6D18a5` | `exactInputSingle((tokenIn,tokenOut,tickSpacing,recipient,deadline,amountIn,amountOutMinimum,sqrtPriceLimitX96))` |
| Aerodrome Slipstream QuoterV2 | `0x254cF9E1E6e233aa1AC962CB9B05b2cfeAaE15b0` | `quoteExactInputSingle((tokenIn,tokenOut,amountIn,tickSpacing,sqrtPriceLimitX96))` |
| Aerodrome CL Factory | `0x5e7BB104d84c7CB9B682AaC2F3d509f5F406809A` | (reference) ts100 pool `0xb2cc224c1c9feE385f8ad6a55b4d94E92359DC59` |
| Chainlink ETH/USD | `0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70` | `latestRoundData` |
| Chainlink USDC/USD | `0x7e860098F58bBFC8648a4311b374B1D669a2bc6B` | `latestRoundData` |
| Chainlink L2 sequencer uptime | `0xBCF85224fc0756B9Fa45aA7892530B47e10b6433` | `latestRoundData` |

The two routers have **different parameter layouts**. SwapRouter02 has no `deadline` in its struct; the deadline goes through `multicall(uint256,bytes[])`. Slipstream puts `deadline` inside the struct and uses `int24 tickSpacing` instead of `uint24 fee`. If you mix these up, the tx reverts or, worse, has no deadline.

## How it protects the fill
1. **Oracle sanity check.** It reads the Chainlink sequencer feed (must be up, and restarted more than 1h ago), ETH/USD (at most 25 min old) and USDC/USD (at most 25 h old). If the quoted all-in cost is more than `MAX_ORACLE_DEV_BPS` worse than the oracle price, it aborts. This protects against a manipulated or drained pool, which quoter-only slippage cannot: a quoter just reports whatever the pool state is.
2. **Per-leg `amountOutMinimum`** = fresh quote − `SLIPPAGE_BPS`. It is enforced on-chain, so the tx reverts rather than fill badly.
3. **Deadline** on every swap, so a tx that sits pending cannot fill later at a stale price.
4. **Simulation** (`simulateContract`) runs before every write, and receipt status is checked after.
5. **Exact-amount approvals**, never unlimited, so the routers hold no leftover allowance on treasury funds.
6. **Post-trade check**: it compares the WETH balance before and after and logs the price actually paid.
7. **Chunking** (`CHUNKS>1`): if one clip costs too much vs the oracle, slice it. Between slices, arbitrage bots pull the pools back to market price.

## What the developer MUST get right before real funds
1. **Key custody.** A raw `PRIVATE_KEY` in an env var is fine for a test wallet, not for a treasury. For production, swap `privateKeyToAccount` for a KMS/HSM signer or route through a Safe (the calldata here can be proposed as Safe txs as-is: approve + router call). Never commit `.env` (it is in `.gitignore`).
2. **RPC.** Use your own or a paid Base RPC. The public `mainnet.base.org` rate-limits the quote grid (≈60 quote calls per run). A lying or stale RPC can feed you bad quotes; the Chainlink check is the backstop, so don't raise `MAX_ORACLE_DEV_BPS` casually.
3. **Right USDC.** Funds must be native USDC `0x8335…2913`, not bridged USDbC `0xd9aA…6CA`. The script only handles native.
4. **Dry run first**, every time, at the real size. Read the planned split, per-leg min-out and "cost vs oracle" line. Then run a small live trade (e.g. 1k USDC) before the first large one.
5. **Tune limits to size.** For reference, 300k cost ~21 bps vs oracle and 1M ~40 bps on 2026-09-21. The default 75 bps limit fits roughly ≤1.5M in one clip. Above that, use `CHUNKS` instead of raising the limit. Chainlink ETH/USD only updates on a 0.15% move, so a limit below ~25 bps may cause false aborts.
6. **Legs are not atomic across venues.** The Uniswap legs go out as one tx and the Aerodrome leg as a second. Each has its own min-out, so the worst case is a partial fill at acceptable prices, never a bad price. If leg 2 reverts, re-run for the USDC left over. If you need all-or-nothing, you need an aggregator or a small custom router contract (see below).
7. **MEV.** Base has no public mempool (the sequencer orders txs; priority fee matters), so classic sandwiching is harder than on L1 but not impossible. Tight `SLIPPAGE_BPS` + short deadline + the oracle bound limit the damage. Don't widen slippage to "make it go through". If it reverts, re-quote.
8. **Addresses change over time.** Everything above was verified on-chain on 2026-09-21. Before first use, re-check against the official docs (Uniswap "Base deployments", Aerodrome GitHub `contracts` README, Circle USDC addresses, data.chain.link for feed addresses and heartbeats). If Aerodrome moves liquidity to a new Slipstream factory/router, the ts100 pool in `VENUES` must be updated.
9. **Gas.** The signer needs a little ETH on Base (a few dollars covers approve + swaps).
10. **Compliance.** USDC can be frozen by Circle. Make sure the sending and receiving wallets are clean or the transfer will revert.

## Possible upgrades (not done, to keep it simple)
- **Aggregator comparison** (0x / 1inch / Odos / KyberSwap, or CoW Swap for MEV-protected batch auctions on Base). They can find routes through intermediate tokens and V4 hook pools, and give one atomic tx. Worth quoting side by side with this script's plan for the largest trades. If adopted, keep the same Chainlink bound and min-out check on their calldata.
- **Atomic multi-venue execution** through a small audited router contract, or Uniswap's Universal Router for the Uni legs.
- **Unwrap to ETH** if the desk wants native ETH (`WETH.withdraw`).
