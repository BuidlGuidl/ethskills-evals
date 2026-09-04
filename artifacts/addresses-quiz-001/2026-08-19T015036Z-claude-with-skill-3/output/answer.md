# Base USDC → WETH swap leg: venue and router

## Answer

**Route through Aerodrome Slipstream** (Aerodrome's concentrated-liquidity AMM),
using its `SwapRouter`:

```
Aerodrome Slipstream SwapRouter (Base, chainId 8453)
0xBE6D8f0d05cC4be24d5167a3eF062215bE6D18a5
```

Supporting addresses for the same config:

| Role | Address |
| --- | --- |
| Slipstream `SwapRouter` (call this) | `0xBE6D8f0d05cC4be24d5167a3eF062215bE6D18a5` |
| Slipstream `QuoterV2` (pre-trade quote) | `0x254cF9E1E6e233aa1AC962CB9B05b2cfeAaE15b0` |
| Slipstream `CLFactory` | `0x5e7BB104d84c7CB9B682AaC2F3d509f5F406809A` |
| Target pool: USDC/WETH, `tickSpacing = 100` | `0xb2cc224c1c9feE385f8ad6a55b4d94E92359DC59` |
| USDC (native, Circle-issued) | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| WETH | `0x4200000000000000000000000000000000000006` |

Slipstream is a Uniswap-v3 fork, so the router takes the familiar
`exactInputSingle` — but the pool key is **`tickSpacing` (int24), not `fee`**.
For this pair use `tickSpacing = 100`.

## Why this venue

**1. It is where the volume is.** DefiLlama, Base DEX volume, pulled
2026-08-19:

| Venue (Base) | 24h volume | 7d volume |
| --- | --- | --- |
| **Aerodrome Slipstream** | **$354.5M** | **$2,286.7M** |
| PancakeSwap AMM V3 | $78.4M | $544.7M |
| Uniswap V3 | $39.3M | $382.1M |
| Uniswap V4 | $17.1M | $226.4M |
| Aerodrome V1 (vAMM) | $5.0M | $23.4M |

**2. It wins on the metric that actually matters — realized slippage at our
clip size.** I quoted 500,000 USDC → WETH live against every candidate pool's
own quoter at Base block **50,157,694** (2026-08-19T01:58Z). Basis points are
measured against the price of a 25k clip in the deepest pool
(1 WETH ≈ 1,914.09 USDC), so they isolate price impact + fee at size:

| Clip | Aero Slipstream ts100 | Uni v3 0.05% | Uni v3 0.30% |
| --- | --- | --- | --- |
| 50k | 26.121 WETH (−0.3 bps) | 26.096 (−10.1) | 26.028 (−35.9) |
| 100k | 52.239 (−1.1) | 52.140 (−19.9) | 52.055 (−36.2) |
| 300k | 156.668 (−4.1) | 155.792 (−60.0) | 156.142 (−37.7) |
| 500k | **261.041 WETH (−6.9 bps)** | 258.520 (−103.4) | 260.198 (−39.1) |

At our size Slipstream is **~32 bps better than Uniswap v3's 0.30% pool and
~96 bps better than its 0.05% pool** — on a 500k clip that is roughly
**$1,600 / $4,800 per swap**.

Two structural reasons it holds up: the pool's fee is dynamic and currently
**3.34 bps** (`fee() = 334`, set by Aerodrome's swap-fee module) versus a fixed
5 or 30 bps on Uniswap; and the pool carries an active AERO gauge
(`0xF33a96b5932D9E9B9A0eDA447AbD8C9d48d2e0c8`), so emissions keep LP depth
parked on it.

**3. Splitting the order buys us almost nothing today.** I built a depth curve
for each venue in 25k increments and ran the optimal split: the best allocation
was 475k Slipstream + 25k Uniswap v3 0.05%, worth **261.052 WETH vs 261.041**
for the single-venue fill — **0.4 bps**, less than the extra gas and the extra
integration surface. Single-venue routing is the right call at this size right
now.

## Venues I ruled out, and one trap worth knowing

- **Aerodrome's v2 `Router` (`0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43`) is
  the wrong Aerodrome contract.** It is a real, live, correct Aerodrome address —
  and it only reaches the old volatile/stable AMM pools, not Slipstream. The
  same 500k clip through the vAMM USDC/WETH pool
  (`0xcDAC0d6c6C59727a65F871236188350531885C43`) returns **230.06 WETH,
  −1,193 bps**, about **$59,000 of slippage on one swap**. The call does not
  revert and the address verifies fine on the explorer. If someone pastes
  "the Aerodrome router" into the config, this is what they get. Do not.
- **Uniswap v4** — the vanilla 0.05%/ts10 USDC/WETH pool filled only
  **7.84 WETH** of a 500k order before running out of liquidity. Not viable yet
  for this pair at this size.
- **Uniswap v3 0.01% and Slipstream ts=1** — tight-fee pools, but they run dry
  at 86.7 and 57.5 WETH respectively. They are fine for small clips only.
- **Uniswap v3 0.30% (`0x2626664c2603336E57B271c5C0b26F421741e481` router)** is
  the credible backup: −39 bps and very flat with size. Wire it as the fallback
  venue if Slipstream depth degrades.
- **An aggregator** (0x / 1inch / KyberSwap / ODOS) is a legitimate alternative
  and worth revisiting as size grows past ~1M per clip, since it handles
  splitting and venue drift for us. It costs a live off-chain quote dependency
  in the execution path, which for a fixed, highly-concentrated pair buying only
  0.4 bps today is not yet worth it.

## Verification performed

Everything above was checked on Base mainnet (chainId 8453), not recalled:

- `cast code` on every address above — all have code on Base.
- Identity, not just presence: the SwapRouter's `factory()` returns the
  Slipstream `CLFactory`, whose `voter()` (`0x1661...80A5`) matches the voter on
  Aerodrome's v2 router — same protocol, CL deployment. The target pool's
  `factory()`, `tickSpacing() = 100`, `token0()`/`token1()` were read directly.
- USDC is the **native Circle issuance** (`0x8335…2913`, 4.22B supply), not
  bridged USDbC (`0xd9aA…b6CA`, 5.74M supply). Confirmed via
  `symbol()`/`name()`/`totalSupply()`.
- Explorer label: BaseScan labels `0xBE6D…18a5` "Aerodrome: SlipStream Swap
  Router" and `0x254c…15b0` "Aerodrome: SlipStream Quoter".
- All quotes are live `eth_call`s against each venue's own quoter at block
  50,157,694.

## Before this moves real money

- **Re-check these addresses yourself against Aerodrome's own deployment list
  before the first funded swap.** I verified them at one block on one day; you
  are the one running it.
- **Quote at execution size, every time.** Call `QuoterV2`
  (`0x254c…15b0`) immediately before the swap and derive
  `amountOutMinimum` from that quote, not from an oracle mid or a stored price.
  The depth numbers above are a snapshot; the −6.9 bps is a property of today's
  liquidity, not a guarantee.
- **Set a real slippage bound and a `deadline`.** At 500k a passive
  `amountOutMinimum` is the entire risk control.
- **Consider clipping.** Impact is meaningfully sublinear below ~200k
  (−2.5 bps at 200k vs −6.9 bps at 500k); splitting a large ticket into
  200–250k child orders across blocks is worth ~3-4 bps if timing allows.
- **Re-benchmark the venue quarterly.** Base's depth ranking moves; Uniswap v4
  liquidity in particular could migrate onto this pair, and the config should
  not outlive the measurement that justified it.
