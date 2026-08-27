# USDC → WETH on Base — treasury swap tool

`swap.ts` is a runnable viem script. It quotes a USDC→WETH clip across every
live USDC/WETH pool on two venues, picks the best fill on the day, enforces a
price-impact ceiling, and executes on the winning router.

```bash
npm install
DRY_RUN=1 AMOUNT_USDC=500000 npx tsx swap.ts        # quote only, nothing signed
PRIVATE_KEY=0x... AMOUNT_USDC=500000 npx tsx swap.ts # execute
```

| env | default | meaning |
| --- | --- | --- |
| `RPC_URL` | `https://mainnet.base.org` | use a paid endpoint for real trades |
| `AMOUNT_USDC` | `500000` | clip size, human units |
| `SLIPPAGE_BPS` | `30` | quote → `amountOutMinimum` haircut |
| `MAX_PRICE_IMPACT_BPS` | `100` | hard abort above this impact |
| `DEADLINE_SECONDS` | `120` | swap deadline |
| `RECIPIENT` | signer | where WETH lands |
| `DRY_RUN` | — | `1` = quote and exit |

## Approach

The venue is **not hardcoded**. At every run the script:

1. **Re-verifies its own addresses against the connected chain** before anything
   is signed: chain id is 8453; `symbol()`/`decimals()` on both tokens; and each
   router *and* quoter's `factory()` matches the factory we expect. A wrong
   address rarely reverts — it reads zero or fills terribly — so the check has to
   run every time, not once at review.
2. **Quotes a 1,000 USDC reference clip** on every pool to establish an
   essentially unimpacted price.
3. **Quotes the real clip** on all nine live USDC/WETH pools (5 Slipstream tick
   spacings, 4 Uniswap v3 fee tiers), prints the whole table in bps against the
   reference, and picks the best.
4. **Aborts if impact exceeds `MAX_PRICE_IMPACT_BPS`** rather than filling into a
   thin book, applies `SLIPPAGE_BPS` to get `amountOutMinimum`, approves *exactly*
   the clip to *exactly* the winning router (no infinite approvals from a
   treasury key), `simulateContract`s, then sends.
5. **Checks the realised WETH balance delta** against the quote and the minimum.

A quoter *revert* means "this pool can't fill the clip" and drops the route. Any
other error — rate limit, timeout — **aborts the run**. This matters: during
testing a rate-limited endpoint made the best venue's quote fail, and an earlier
version silently dropped it and routed the clip through a pool 25 bps worse.

## Venue: Aerodrome Slipstream, tick spacing 100

Measured with the script's own quoters at Base block ~50,144,700 (2026-08-18),
500,000 USDC in, versus an unimpacted 1,000-USDC reference fill:

| venue / pool | out (WETH) | vs reference |
| --- | ---: | ---: |
| **Slipstream ts=100** `0xb2cc…DC59` | **260.671** | **−11 bps** |
| Uniswap v3 fee=3000 `0x6c56…1372` | 260.161 | −30 bps |
| Uniswap v3 fee=500 `0xd0b5…F224` | 258.214 | −105 bps |
| Uniswap v3 fee=10000 | 118.945 | −5442 bps |
| Uniswap v3 fee=100 | 83.732 | −6791 bps |
| Slipstream ts=1 | 57.446 | −7798 bps |
| Slipstream ts=2000 / ts=50 / ts=200 | ≤ 4.4 | dead |

So at this size Slipstream ts=100 is worth roughly **0.5 WETH (~$1,000)** over the
best Uniswap v3 tier on a single 500k clip. Two things worth knowing:

- **Splitting did not help.** 250k/250k across Slipstream ts=100 and Uniswap v3
  0.3% returned 260.707 WETH, and 400k/100k returned 260.898 — both *worse* than
  260.892–261.042 for the whole clip through Slipstream alone. Re-test this at
  your actual size; it flips as soon as the depth ratio moves.
- **Uniswap v4 is not a contender for this pair on Base today.** The v4 Quoter
  (`0x0d5e…048D`, `poolManager()` = `0x4985…2b2b`) returned 64.9 WETH for the 0.3%
  pool and 7.9 for the 0.05% pool on a 500k clip. Those pools exist and answer;
  they just have no depth here.

### The trap this script exists to avoid

Aerodrome runs **two** AMMs. The one most code reaches for — the v2-style
`Router` at `0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43` — **cannot see Slipstream
pools at all**. It is a genuine, verified, live Aerodrome router; the call
succeeds; nothing reverts. On the same 500k clip it quoted **230.229 WETH,
−1,189 bps** — about **$60,000 worse** than the Slipstream fill, for the same
protocol brand and the same token pair.

Slipstream is a separate deployment: separate factory, separate router, pools
keyed by `int24 tickSpacing` rather than `uint24 fee`, and the router struct
still carries the v3 `deadline` field that Uniswap's SwapRouter02 dropped. The
two `exactInputSingle` structs are **not** interchangeable — both ABIs are in
`swap.ts` and the script picks the right one per venue.

## Addresses

All verified on Base mainnet (8453) on 2026-08-18 by reading code and identity
from the chain, not from a table.

| what | address | how it was confirmed |
| --- | --- | --- |
| USDC (native, Circle) | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | `symbol()`=USDC, `decimals()`=6 |
| WETH | `0x4200000000000000000000000000000000000006` | `symbol()`=WETH, `decimals()`=18 |
| Slipstream SwapRouter | `0xBE6D8f0d05cC4be24d5167a3eF062215bE6D18a5` | `factory()` matches the CLFactory row |
| Slipstream CLFactory | `0x5e7BB104d84c7CB9B682AaC2F3d509f5F406809A` | returns all 5 ts pools for the pair |
| Slipstream Quoter | `0x254cF9E1E6e233aa1AC962CB9b05b2cfeAaE15b0` | `factory()` matches the CLFactory row |
| Uniswap SwapRouter02 | `0x2626664c2603336E57B271c5C0b26F421741e481` | `factory()` matches the v3 Factory row |
| Uniswap v3 Factory | `0x33128a8fC17869897dcE68Ed026d694621f6FDfD` | returns all 4 fee-tier pools |
| Uniswap QuoterV2 | `0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a` | `factory()` matches the v3 Factory row |

**`USDbC` (`0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA`) is the bridged dollar and
is deliberately not used.** It shows as "USDbC"/"USD Base Coin", is a different
address, and has different liquidity. If the desk's USDC arrives from a bridge
rather than from Circle, check which token actually landed before running this.

Re-check any of them yourself:

```bash
R=https://mainnet.base.org
cast code 0xBE6D8f0d05cC4be24d5167a3eF062215bE6D18a5 --rpc-url $R          # code on THIS chain
cast call 0xBE6D8f0d05cC4be24d5167a3eF062215bE6D18a5 "factory()(address)" --rpc-url $R
cast call 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 "symbol()(string)"  --rpc-url $R
```

## Before you run this with real funds

1. **Re-verify the addresses yourself.** They were confirmed on 2026-08-18 and
   the script re-checks them each run, but the script only proves a contract is
   self-consistent — it cannot tell you Aerodrome has not shipped a newer router.
   Settle the router and quoter against the Aerodrome and Uniswap deployment
   lists and BaseScan on the day you trade. You did not watch me check.
2. **Re-run the venue comparison at your real size.** The table above is one
   block on one day. The script reprints it every run — read it, do not skip to
   the fill. If two venues are within a few bps, the split arithmetic in
   `quoteAll` is the place to extend.
3. **Use a private, paid RPC.** Public endpoints rate-limit mid-run. The script
   now aborts rather than degrading, but an abort after the approve has landed
   still leaves a standing allowance.
4. **Set the risk parameters deliberately.** `SLIPPAGE_BPS=30` and
   `MAX_PRICE_IMPACT_BPS=100` are starting points sized to the measurements
   above; at 500k the observed impact was ~11 bps, so 100 is a loose ceiling.
   Tighten both for routine clips.
5. **Dry-run first, every time.** `DRY_RUN=1` signs nothing.
6. **Fund gas.** The signer needs ETH on Base; the Slipstream swap measured
   ~204k gas on a forked execution.
7. **Think about ordering.** Base's sequencer does not gossip a public mempool,
   so classic sandwiching is harder than on L1 — but it is not zero risk, and
   `amountOutMinimum` plus the deadline is what actually protects the fill. Do
   not raise `SLIPPAGE_BPS` to make a stubborn transaction go through.
8. **Custody.** `PRIVATE_KEY` in an env var is fine for a desk operator running
   this by hand and wrong for anything automated. For recurring flow, move the
   signing to a hardware wallet or a Safe and keep the quote/route logic here.

## What this does not do

- No TWAP / clip scheduling. For "hundreds of thousands per swap" as a *repeated*
  flow, slicing over time will beat any single-block route; this tool fills one
  clip.
- No aggregator. A 0x / KyberSwap / 1inch route could beat a single pool by
  splitting across venues this script does not quote (Sushi, PancakeSwap,
  Curve on Base). The direct route was chosen because it is fully verifiable
  on-chain with no off-chain quote API in the trust path — but before a really
  large clip, price an aggregator against the table this prints and take the
  better number.
- No Permit2. Plain per-clip `approve` to the router, which both routers accept.

## Verification performed

- Every address above read from Base mainnet (code + identity), 2026-08-18.
- Quotes in the table taken from the on-chain quoters, not a price API.
- End-to-end execution proven on an anvil fork of Base mainnet: `swap.ts` ran the
  full path (preflight → quote → approve → simulate → send → balance check) and
  filled 500,000 USDC, and the Slipstream `exactInputSingle` struct was executed
  directly against `0xBE6D…18a5` for 500,000 USDC → 260.403 WETH, status 1,
  203,852 gas.
