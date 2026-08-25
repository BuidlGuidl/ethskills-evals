# Base USDC → WETH swap leg: venue & router recommendation

## TL;DR

For your ticket size (hundreds of thousands of USDC per swap), the deepest
*effective* venue on Base right now is **Aerodrome Slipstream**, the
concentrated-liquidity WETH/USDC pool at tick spacing 100.

```
# Aerodrome Slipstream SwapRouter (Base, chainId 8453)
ROUTER = 0xBE6D8f0d05cC4be24d5167a3eF062215bE6D18a5
```

But read the "important caveat" section before this goes into config: the
best venue **flips to Uniswap v3 at around $1.25M per swap**, so if your
tickets ever grow past ~$1M you want a quote-then-route design, not a
hardcoded router. My actual recommendation is the two-venue design in the
last section.

---

## How I got here

I did not answer this from memory. I queried Base mainnet directly
(`cast`, public RPC `https://base-rpc.publicnode.com`, ~block **50158346**)
to (a) confirm every address is really the contract I claim it is, and
(b) measure real execution at your size rather than reasoning about "TVL".

### Step 1 — verify the candidate routers are what they claim to be

Every address below has code on Base and self-identifies correctly via its
own getters:

| Contract | Address | Verified by |
|---|---|---|
| Aerodrome Slipstream SwapRouter | `0xBE6D8f0d05cC4be24d5167a3eF062215bE6D18a5` | `factory()` → `0x5e7BB104d84c7CB9B682AaC2F3d509f5F406809A` (Slipstream CL factory), `WETH9()` → `0x4200…0006` |
| Uniswap SwapRouter02 | `0x2626664c2603336E57B271c5C0b26F421741e481` | `factory()` → `0x33128a8fC17869897dcE68Ed026d694621f6FDfD` (Uni v3 Base factory), `WETH9()` → `0x4200…0006` |
| Uniswap Universal Router (v4-enabled) | `0x6fF5693b99212Da76ad316178A184AB56D299b43` | `poolManager()` → `0x498581fF718922c3f8e6A244956aF099B2652b2b` (v4 PoolManager) |
| Aerodrome v2 Router (AMM, **not** recommended) | `0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43` | `defaultFactory()` → `0x420DD381b31aEf6683db6B902084cB0FFECe40Da`, `voter()` → `0x16613524e02ad97eDfeF371bC883F2F5d6C480A5` |

Tokens used throughout:
- USDC (native Circle USDC on Base): `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
- WETH: `0x4200000000000000000000000000000000000006`

### Step 2 — enumerate the actual WETH/USDC pools

Pulled from each factory rather than assumed:

| Venue | Pool | Address |
|---|---|---|
| Uniswap v3 | 0.01% | `0xb4CB800910B228ED3d0834cF79D697127BBB00e5` |
| Uniswap v3 | 0.05% | `0xd0b53D9277642d899DF5C87A3966A349A798F224` |
| Uniswap v3 | 0.30% | `0x6c561B446416E1A00E8E93E221854d6eA4171372` |
| Aerodrome Slipstream | ts=100 (fee `498` = 0.0498%) | `0xb2cc224c1c9feE385f8ad6a55b4d94E92359DC59` |
| Aerodrome v2 | volatile | `0xcDAC0d6c6C59727a65F871236188350531885C43` |
| Uniswap v4 | ETH/USDC 0.30%, ts=60 | in PoolManager `0x498581fF718922c3f8e6A244956aF099B2652b2b` |

### Step 3 — quote real swaps, don't eyeball TVL

Balances are a bad proxy for execution — most of a pool's token balance can
sit outside the active tick range. So I ran on-chain quoter calls:

- Uniswap v3 QuoterV2 `0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a`
- Slipstream QuoterV2 `0x254cF9E1E6e233aa1AC962CB9B05b2cfeAaE15b0`
- Uniswap v4 Quoter `0x0d5e0F971ED27FBfF6c2837bf31316121532048D`

**WETH received for a given USDC input (single hop, exact-in):**

| USDC in | Aero Slipstream ts100 | Uni v3 0.30% | Uni v3 0.05% | Uni v4 (ETH/USDC 0.30%) | Aero v2 |
|---:|---:|---:|---:|---:|---:|
| 100,000 | **52.3477** | 52.0660 | 52.2298 | – | 50.7674 |
| 500,000 | **261.4997** | 260.2546 | 259.0059 | 252.3513 | 230.3955 |
| 1,000,000 | **522.3396** | 520.3203 | 511.6559 | – | – |
| 1,250,000 | **651.2466** | 651.2207 | – | – | – |
| 1,500,000 | 779.9356 | **781.3231** | – | – | – |
| 2,000,000 | 1033.3409 | **1040.8250** | 991.5717 | – | – |
| 5,000,000 | 2283.0540 | **2596.3897** | 2105.3276 | – | – |

At **$500k**, Aerodrome Slipstream returns **1.245 more WETH** than the next
best venue (~$2.4k on a single swap, ~48 bps). That is the whole reason to
pick it.

### Why Aerodrome wins at your size

Two effects pull in opposite directions:

- **Fee.** The Slipstream ts100 pool charges `fee() = 498` (0.0498%) vs
  Uniswap's 0.30% tier. On a $500k clip that fee gap alone is ~$1,250.
- **Depth.** In-range liquidity is `liquidity()` = 5.59e18 on the Slipstream
  pool vs 3.14e19 on Uniswap's 0.30% pool — Uniswap is ~5.6× deeper at the
  active tick.

Below ~$1.25M the fee advantage dominates and Aerodrome wins. Above it,
Uniswap's depth dominates and the curve inverts hard (at $5M Uniswap is
**13.7% better** — Aerodrome by then is walking off a liquidity cliff).

Two other findings worth recording:

- **Uniswap v4 is not competitive for this pair on Base yet.** The best v4
  pool I found (native ETH/USDC, 0.30%/ts60) returned 252.35 WETH on $500k
  vs 261.50 on Aerodrome — ~3.5% worse. Don't route treasury flow through
  the Universal Router expecting v4 depth.
- **Naive splitting makes things worse, not better.** 250k Aerodrome +
  250k Uniswap-0.30% = 261.0036 WETH, versus 261.4997 for the full 500k
  through Aerodrome alone. Splitting only pays once you're past the
  crossover, and only if the split point is solved for properly.
- **Aerodrome v2 (the non-CL AMM) is disqualified** — 230.40 WETH on $500k,
  ~12% worse. Make sure you're calling the Slipstream router, not the v2
  router. They're different contracts.

---

## Important caveat before this goes into config

The measurement above is a single block. Liquidity on Base migrates between
Aerodrome and Uniswap on emissions/incentive cycles, and your crossover
point ($1.25M) sits uncomfortably close to your stated ticket size. A
hardcoded router address is a decision you'd be making once, on behalf of
every future swap, using today's liquidity distribution.

**What I'd actually integrate:** quote both venues at execution time and
route to the winner. It's ~30 lines and both quoters are `view`-callable
off-chain for free:

```
QUOTER_AERO = 0x254cF9E1E6e233aa1AC962CB9B05b2cfeAaE15b0
QUOTER_UNI  = 0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a

ROUTER_AERO = 0xBE6D8f0d05cC4be24d5167a3eF062215bE6D18a5   # Slipstream
ROUTER_UNI  = 0x2626664c2603336E57B271c5C0b26F421741e481   # SwapRouter02
```

If you want one address today and will revisit later, use `ROUTER_AERO`.

### Integration details that will bite you

1. **Slipstream's router is Uniswap-v3-shaped but not identical.** Its
   `exactInputSingle` params take **`int24 tickSpacing`** where Uniswap
   takes `uint24 fee` — same struct position, different meaning. For the
   pool you want, pass `tickSpacing = 100`. Multi-hop path encoding differs
   the same way. If you copy a Uniswap integration verbatim it will compile
   and then route to the wrong pool or revert.
2. **Set `amountOutMinimum` from a fresh quote, never from a fixed bps.**
   Both quoters are non-view in their canonical ABI (they revert-and-decode);
   call them via `eth_call` and let them consume gas. Budget generously —
   deep CL quotes cross many ticks and are slow; a short RPC client timeout
   will surface as a failed/empty quote and look like an empty pool.
3. **Use a private mempool / MEV-protected submission.** At $500k with ~48
   bps of edge on the line, a public-mempool sandwich costs more than your
   venue choice earns. This matters more than the router address does.
4. **Native USDC only.** `0x833589…2913` is Circle's native USDC. Do not
   confuse it with bridged USDbC — different token, different liquidity.
5. Approve the router for USDC; Slipstream's router uses plain ERC-20
   approvals (no Permit2 requirement), unlike Uniswap's Universal Router.

### On aggregators

For a treasury desk doing size regularly, an aggregator API (1inch, 0x,
Odos, KyberSwap) is the genuinely right long-term answer — they solve the
split-routing problem you'd otherwise be hand-maintaining, and they re-solve
it every block as liquidity moves. I'm deliberately **not** giving you an
aggregator router address here: those contracts are versioned and rotate
(0x in particular has moved to per-release Settler deployments), so the
right source is the vendor's own address endpoint fetched at integration
time, not a constant pasted from an answer document. Every address in this
document is one I verified on-chain today; I'm not going to hand you one I
can't verify the same way.

---

## Verification appendix

Anyone can reproduce the core claim:

```bash
R=https://base-rpc.publicnode.com
USDC=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
WETH=0x4200000000000000000000000000000000000006

# router is really the Slipstream router
cast call 0xBE6D8f0d05cC4be24d5167a3eF062215bE6D18a5 "factory()(address)" --rpc-url $R
# -> 0x5e7BB104d84c7CB9B682AaC2F3d509f5F406809A

# 500k USDC -> WETH through Slipstream ts=100
cast call 0x254cF9E1E6e233aa1AC962CB9B05b2cfeAaE15b0 \
  "quoteExactInputSingle((address,address,uint256,int24,uint160))(uint256,uint160,uint32,uint256)" \
  "($USDC,$WETH,500000000000,100,0)" --rpc-url $R

# same size through Uniswap v3 0.30%
cast call 0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a \
  "quoteExactInputSingle((address,address,uint256,uint24,uint160))(uint256,uint160,uint32,uint256)" \
  "($USDC,$WETH,500000000000,3000,0)" --rpc-url $R
```

Numbers will drift with block; the method won't. Re-run before you size a
large clip.
