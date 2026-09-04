# Base swap leg: which router for large USDC → WETH

**Recommendation: route through Aerodrome Slipstream (concentrated-liquidity) —
router `0xBE6D8f0d05cC4be24d5167a3eF062215bE6D18a5`, USDC/WETH pool with
`tickSpacing = 100`.**

Keep Uniswap `SwapRouter02` (`0x2626664c2603336E57B271c5C0b26F421741e481`) in the
config as a second route and pick between them from a live quote at trade time —
the margin is real but not large enough to hardcode one venue forever. Reasoning and
measurements below.

---

## 1. What I actually measured

Everything here is measured on Base mainnet (chain id 8453) around block
**50,157,779–50,157,992**, using the on-chain quoters, not from documentation or memory.
Reference rate from a 25k slice: **1912.01 USDC/ETH** (fee-inclusive, so the "cost vs
reference" column slightly understates every venue by ~4 bps — it's fine for ranking).

`quoteExactInputSingle`, exact-input USDC → WETH:

| Size | Venue | WETH out | Effective USDC/ETH | Cost vs 25k-slice rate |
|---|---|---|---|---|
| 100k | **Aerodrome CL, ts=100** | **52.2952** | 1912.22 | 0.011% ($11) |
| 100k | Uniswap v3, 0.05% | 52.1895 | 1916.09 | 0.213% ($213) |
| 100k | Uniswap v3, 0.30% | 52.0549 | 1921.05 | 0.473% ($473) |
| 100k | Uniswap v4, ETH/USDC 0.30% | 51.7579 | 1932.07 | 1.049% ($1,049) |
| 100k | Aerodrome v2 volatile | 50.7149 | 1971.81 | 3.127% ($3,127) |
| 250k | **Aerodrome CL, ts=100** | **130.7082** | 1912.66 | 0.034% ($84) |
| 250k | Uniswap v3, 0.30% | 130.1230 | 1921.26 | 0.484% ($1,209) |
| 250k | Uniswap v3, 0.05% | 130.0876 | 1921.78 | 0.511% ($1,277) |
| 250k | Uniswap v4, ETH/USDC 0.30% | 128.2665 | 1949.07 | 1.938% ($4,845) |
| 250k | Aerodrome v2 volatile | 122.1286 | 2047.02 | 7.061% ($17,653) |
| **500k** | **Aerodrome CL, ts=100** | **261.2525** | **1913.86** | **0.096% ($482)** |
| 500k | Uniswap v3, 0.30% | 260.1987 | 1921.61 | 0.502% ($2,509) |
| 500k | Uniswap v3, 0.05% | 258.7883 | 1932.08 | 1.050% ($5,248) |
| 500k | Uniswap v4, ETH/USDC 0.30% | 252.3483 | 1981.39 | 3.628% ($18,142) |
| 500k | Aerodrome v2 volatile | 230.1647 | 2172.36 | 13.616% ($68,081) |

It keeps holding above your stated size:

| Size | Aero CL ts=100 | Uni v3 0.30% | Uni v3 0.05% |
|---|---|---|---|
| 1,000,000 USDC | 522.174 WETH | 520.209 | 511.381 |
| 2,000,000 USDC | 1042.969 WETH | 1039.664 | 989.608 |

**On a $500k clip Aerodrome CL beats the best Uniswap v3 pool by ~1.05 WETH ≈ $2,000
(40 bps).** That is the whole argument — at your size this single line item dwarfs
every other integration consideration.

### Why it wins

It is *not* raw depth — the Uniswap 0.30% pool actually has more liquidity:

| Pool | Address | USDC held | WETH held | active `liquidity()` | fee |
|---|---|---|---|---|---|
| Uni v3 0.30% | `0x6c561B446416E1A00E8E93E221854d6eA4171372` | 59,610,820 | 27,796.6 | 3.138e19 | 3000 (0.30%) |
| **Aero CL ts=100** | `0xb2cc224c1c9feE385f8ad6a55b4d94E92359DC59` | 4,273,313 | 3,075.3 | 1.447e19 | **319–394 (~0.03–0.04%), dynamic** |
| Uni v3 0.05% | `0xd0b53D9277642d899DF5C87A3966A349A798F224` | 3,109,807 | 3,710.2 | — | 500 (0.05%) |
| Aero v2 volatile | `0xcDAC0d6c6C59727a65F871236188350531885C43` | 3,822,535 | 1,994.5 | — | xy=k |

Aerodrome CL has ~half the active liquidity of the deep Uniswap pool but charges
**~3–4 bps instead of 30 bps**, and its liquidity is tight enough that $500k only
walks the price 0.1%. Uniswap's 0.05% pool has comparable depth but 5 bps of fee and
noticeably thinner book — it degrades fastest as size grows (0.21% → 1.05% between
100k and 500k).

Aerodrome v2 (the xy=k pool) and Uniswap v4 are simply not competitive on this pair
today; v4's whole singleton only holds ~10.4M USDC / ~4,381 WETH / ~4,610 native ETH
across *all* pools.

## 2. I executed it, not just quoted it

Quotes can lie about calldata shape. On an anvil fork of Base pinned at block
50,157,992, funded with USDC via a storage override:

```
Aerodrome Slipstream router 0xBE6D8f0d05cC4be24d5167a3eF062215bE6D18a5
  exactInputSingle((tokenIn, tokenOut, tickSpacing=100, recipient, deadline,
                    500_000e6, amountOutMinimum, sqrtPriceLimitX96=0))
  -> status 0x1, 261.240544003486441127 WETH, gas 261,388

Uniswap SwapRouter02 0x2626664c2603336E57B271c5C0b26F421741e481
  exactInputSingle((tokenIn, tokenOut, fee=3000, recipient,
                    500_000e6, amountOutMinimum, sqrtPriceLimitX96=0))
  -> status 0x1, 260.198929623699002679 WETH, gas 148,645
```

Note the struct differs between the two: **Slipstream takes `int24 tickSpacing` and a
`deadline`; SwapRouter02 takes `uint24 fee` and no `deadline`.** Don't copy Uniswap
calldata onto the Aerodrome router.

The 113k extra gas is irrelevant here — Base base fee was 5 gwei… in *wei*
(0.005 gwei), so the whole Aerodrome swap costs well under a cent of L2 gas plus the
L1 data fee. Gas is ~4 orders of magnitude below the 40 bps execution edge.

## 3. Why not an aggregator?

I checked, because for $500k clips "just use an aggregator" is usually right.

I solved for the **optimal split** of 500k USDC across all five venues in 25k
increments (quotes across distinct pools are independent, so the sum is exactly what a
splitting router would realise). The optimum is 450k on Aerodrome CL + 50k on Uniswap
v3 0.05%, for 261.2916 WETH — **+0.039 WETH, or +1.5 bps (~$75), over just sending the
whole clip to Aerodrome CL.** That is not worth a third-party contract in your
critical path.

The KyberSwap aggregator API quoted 261.609 WETH (+14 bps over single-venue
Aerodrome), but it gets there by routing 6 hops through PMM/RFQ sources
(`tessera`, `hanji`, `native-v2`, `axima-v2`) whose prices are off-chain signed quotes.
Those are not reproducible from on-chain state, cannot be verified in a simulation
before you sign, and can be withdrawn. For a treasury desk that's a different risk
profile than a plain AMM call, for 14 bps.

So: **integrate the AMM router directly.** If you later want aggregator upside, add it
as an *optional* route that has to beat the direct on-chain quote by a margin,
not as the default.

## 4. Caveats you should wire in, not ignore

1. **Aerodrome CL's fee is dynamic.** `pool.fee()` returned **394** on one read and
   **319** a few minutes later — it's set by a swap fee module
   (`0x090b2A6bb475c00e2256e2095A60887cD710803b`) under Aerodrome governance. Still far
   below Uniswap's 30 bps, but it means the venue's economics can change without you
   redeploying anything.
2. **The 40 bps edge is not structural.** Aerodrome's depth here is rented with AERO
   emissions via the pool's gauge (`0xF33a96b5932D9E9B9A0eDA447AbD8C9d48d2e0c8`). If
   emissions rotate away, liquidity leaves and Uniswap wins. **Quote both routers at
   trade time and take the better one** — that's ~2 `eth_call`s and it makes the
   decision self-correcting rather than a config value that silently goes stale.
3. **Always set `amountOutMinimum` from a fresh quoter call**, never from a stored
   price, and bound it (e.g. quote − 20 bps). `sqrtPriceLimitX96 = 0` is fine *only*
   because min-out is doing the protecting.
4. **Split large clips over time, not over venues.** 500k costs ~10 bps of impact;
   2M in one clip costs ~50 bps on the same pool. If you're moving multiple millions,
   time-slicing into ~500k clips is worth far more than any venue choice.
5. Base has a single sequencer with a private mempool, so classic sandwiching is
   limited, but your transaction is still visible for the block after inclusion —
   the min-out bound is your actual protection, not the mempool model.

## 5. Config values (all verified on Base mainnet, chain id 8453)

```jsonc
{
  // primary swap venue
  "router":       "0xBE6D8f0d05cC4be24d5167a3eF062215bE6D18a5", // Aerodrome Slipstream SwapRouter
  "quoter":       "0x254cF9E1E6e233aa1AC962CB9B05b2cfeAaE15b0", // Slipstream QuoterV2
  "tickSpacing":  100,
  "pool":         "0xb2cc224c1c9feE385f8ad6a55b4d94E92359DC59", // USDC/WETH ts=100

  // fallback / comparison venue
  "altRouter":    "0x2626664c2603336E57B271c5C0b26F421741e481", // Uniswap SwapRouter02
  "altQuoter":    "0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a", // Uniswap QuoterV2
  "altFee":       3000,

  "USDC":         "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // 6 decimals
  "WETH":         "0x4200000000000000000000000000000000000006"  // 18 decimals
}
```

### How each address was verified

I didn't take any of these from memory or docs — each one was confirmed against chain
state:

- `USDC` / `WETH`: `symbol()` = "USDC"/"WETH", `decimals()` = 6/18.
- Aerodrome Slipstream router `0xBE6D…18a5`: `factory()` →
  `0x5e7BB104d84c7CB9B682AaC2F3d509f5F406809A` (Slipstream CLFactory),
  `WETH9()` → WETH. That same CLFactory is what `getPool(USDC, WETH, 100)` resolves the
  deep pool from, and what the Slipstream quoter reports — so router, factory, quoter
  and pool are all mutually consistent.
- Uniswap `SwapRouter02` `0x2626…e481`: `factory()` →
  `0x33128a8fC17869897dcE68Ed026d694621f6FDfD` (Uniswap v3 factory on Base),
  `WETH9()` → WETH.
- Quoters: `0x254c…15b0` reports the Slipstream CLFactory, `0x3d4e…B76a` reports the
  Uniswap v3 factory.
- **Live usage:** decoding `Swap` event senders over the last 900 blocks,
  `0xbe6d…18a5` is among the top swappers on the Aerodrome ts=100 pool, and
  `0x2626…e481` is the top swapper on both Uniswap v3 pools — these are the contracts
  real flow goes through, not just addresses that happen to have code.
- Both routers were then **executed for real** against a pinned Base fork (§2).

Also checked and rejected as the answer: Uniswap Universal Router
`0x6fF5693b99212Da76ad316178A184AB56D299b43` (real — its `poolManager()` is the v4
singleton `0x498581fF718922c3f8e6A244956aF099B2652b2b` — but v4 liquidity on this pair
is thin), Aerodrome v2 router `0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43`
(`voter()` → `0x16613524e02ad97eDfeF371bC883F2F5d6C480A5`; xy=k pool, 13.6% impact at
500k), and the aggregator routers (§3).

> Prices, fees and pool depths above are a snapshot at block ~50,157,900. The address
> list is stable; the 40 bps ranking is not — which is exactly why point 4.2 says to
> quote both at trade time.
