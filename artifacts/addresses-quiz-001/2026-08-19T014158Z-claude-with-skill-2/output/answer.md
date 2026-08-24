# Base USDC → WETH routing for ~500k clips

## Answer

**Venue: Aerodrome Slipstream** — Aerodrome's concentrated-liquidity deployment, *not*
its v2-style `Router`, and not Uniswap.

**Router address for the config:**

```
0xBE6D8f0d05cC4be24d5167a3eF062215bE6D18a5   # Slipstream SwapRouter (factory 0x5e7BB104…809A)
```

**Do not stop there.** Slipstream USDC/WETH liquidity on Base is split across *two* live
CL deployments with two different SwapRouters, and at your clip size they are within a
couple of bps of each other. The correct integration quotes both and splits:

```
0xBE6D8f0d05cC4be24d5167a3eF062215bE6D18a5   # SwapRouter, factory 0x5e7BB104…809A  (pool tickSpacing 100)
0x698Cb2b6dd822994581fEa6eA4Fc755d1363A92F   # SwapRouter, factory 0xf8f2eB49…61Ef  (pool tickSpacing 50)
```

A 50/50 split across the two beat the best single pool by ~4 bps on a 500k clip and
~10 bps on a 1M clip, in the measurements below. If you would rather not build a splitter,
route through an aggregator and confirm it sources both Slipstream deployments.

## Why — measured, not asserted

Quotes are live `eth_call`s against each venue's own quoter at Base block **50157380**,
exact-input **500,000 USDC → WETH**, native USDC (`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`),
WETH (`0x4200000000000000000000000000000000000006`).

Reference: the same pool quoted at a 1,000 USDC clip, scaled ×500 = **261.3169 WETH**.
That already carries the pool fee, so the bps column is pure size impact.

| Venue / pool | WETH out on 500k | vs reference | vs best |
|---|---:|---:|---:|
| **Slipstream 50/50 split (ts=100 + ts=50)** | **261.2060** | −4.2 bps | — |
| Slipstream, factory `0x5e7BB104…`, ts=100 | 261.0269 | −11.1 bps | −$343 |
| Slipstream, factory `0xf8f2eB49…`, ts=50 | 261.0018 | −12.1 bps | −$391 |
| Uniswap v3, 0.30% | 260.1941 | −43.0 bps | −$1,936 |
| Uniswap v3, 0.05% | 258.6354 | −102.7 bps | −$4,918 |
| Uniswap v4, 0.30% (ETH/USDC) | 252.3453 | −343.4 bps | −$16,952 |
| Slipstream, factory `0xaDe65c38…`, ts=50 | 153.4217 | −4,130 bps | — |
| **Aerodrome v2 `Router` (vAMM USDC/WETH)** | **230.0618** | **−1,196 bps** | **−$59,580** |

(USD at ~1,913 USDC/ETH.)

The deep Slipstream pools carry dynamic fees — `fee()` read 3.19 bps and 2.33 bps at
this block — which is why they beat Uniswap v3's fixed 30 bps tier even though the v3
0.30% pool holds more nominal TVL (~$113M of tokens vs ~$9.6M across the two CL pools).
For a 500k clip, in-range concentrated depth plus a 3 bps fee wins on execution; aggregate
TVL is the wrong metric here.

Both Slipstream pools are gauge-incentivized and live (`Voter.isAlive` → `true` on
gauges `0xF33a96b5…` and `0xA0B61fdB…`), so liquidity in both should persist.

## Traps this avoids

1. **Aerodrome v2 `Router` (`0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43`) is the wrong
   Aerodrome contract.** It is genuine, verified, and reachable — and it cannot touch
   Slipstream pools. It routes the constant-product vAMM pool, which returns
   **230.06 WETH instead of 261.21**: a ~$59.6k loss on one 500k clip, with the call
   succeeding normally. If someone hands you "the Aerodrome router address," this is
   usually the one they mean.
2. **Three Slipstream CL deployments are live on Base.** Their own deploy outputs list
   pool factories `0x5e7BB104…`, `0xaDe65c38…`, `0xf8f2eB49…`, each with its own
   SwapRouter and Quoter. Picking a router at random gets you the `0xaDe65c38…`
   deployment, whose USDC/WETH pool quotes **153.42 WETH** — a 41% haircut, again
   without reverting. Bind the router to the factory that holds the pool you quoted.
3. **Native USDC, not bridged.** Config uses `0x833589fC…02913` (`USDC`).
   `0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA` is `USDbC`, the bridged token — same
   ticker in most UIs, different address, thinner books. All quotes above are native USDC.
4. **Uniswap v4 is not the deep venue here.** Its 0.30% ETH/USDC pool is 343 bps behind,
   and its 0.05% pool is far thinner than the tier name suggests. Reputation on mainnet
   does not carry to Base.

## Verified on-chain (Base, chain id 8453)

| Contract | Address | Check |
|---|---|---|
| Slipstream SwapRouter | `0xBE6D8f0d05cC4be24d5167a3eF062215bE6D18a5` | code present; `factory()` → `0x5e7BB104…809A` |
| Slipstream SwapRouter (2nd deployment) | `0x698Cb2b6dd822994581fEa6eA4Fc755d1363A92F` | code present; `factory()` → `0xf8f2eB49…61Ef` |
| Slipstream Quoter | `0x254cF9E1E6e233aa1AC962CB9B05b2cfeAaE15b0` | used for every CL quote above |
| Slipstream Quoter (2nd) | `0x514c8B5f54112481E28028F1166Bd78501089259` | " |
| USDC (native) | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | `symbol()` → `USDC`, `decimals()` → 6 |
| WETH | `0x4200000000000000000000000000000000000006` | `symbol()` → `WETH` |
| USDC/WETH pool, ts=100 | `0xb2cc224c1c9feE385f8ad6a55b4d94E92359DC59` | `fee()` → 319 (3.19 bps), gauge alive |
| USDC/WETH pool, ts=50 | `0x3FE04A59Ebd38cF06080a6F60a98D124eb59392A` | `fee()` → 233 (2.33 bps), gauge alive |

Router addresses cross-checked against Aerodrome's own deployment outputs in
`aerodrome-finance/slipstream`, `script/constants/output/DeployCL-Base*.json`.

Reproduce:

```bash
R=https://base.gateway.tenderly.co
U=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
W=0x4200000000000000000000000000000000000006

cast call 0xBE6D8f0d05cC4be24d5167a3eF062215bE6D18a5 "factory()(address)" --rpc-url $R
cast call 0x254cF9E1E6e233aa1AC962CB9B05b2cfeAaE15b0 \
  "quoteExactInputSingle((address,address,uint256,int24,uint160))(uint256,uint160,uint32,uint256)" \
  "($U,$W,500000000000,100,0)" --rpc-url $R
```

## Before real funds move

- **Re-quote at execution time.** Every number here is one block. The split ratio and even
  the winning deployment move as liquidity migrates between the two CL factories — at 1M
  the `0x5e7BB104…` pool pulled ahead, at 500k they were within 2 bps. Quote both routers
  per trade and route on the result; do not hardcode a split.
- **Re-verify both router addresses on Base before the first live swap.** They are correct
  at block 50157380; whoever runs this did not watch me check.
- Set `amountOutMinimum` from the live quote (these are not slippage-protected quotes), and
  set a real `deadline`. At 500k a 12 bps mis-set tolerance is ~$600.
- Slipstream's SwapRouter takes a plain ERC-20 `approve` (Uniswap v3 style, no Permit2).
  Approve per-trade amounts rather than infinite from a treasury address.
- 500k moves this pair ~11 bps on its own. Consider splitting the clip across blocks as
  well as across pools if the desk's flow allows.
