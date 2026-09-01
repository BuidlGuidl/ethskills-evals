Done. `forge build` and `forge test` both pass — 35 tests, 0 failures.

## What I built

```
src/UsdcWethVault.sol         vault: deposit/withdraw/harvest, admin, emergency exit
src/BaseAddresses.sol         Base addresses, each read back from chain
src/interfaces/IAerodrome.sol Router / Pool / Factory / Gauge
script/Deploy.s.sol           deploy, gated on gauge liveness
script/Harvest.s.sol          keeper entry point
test/UsdcWethVault.t.sol      26 unit tests vs. constant-product mocks
test/fork/…Fork.t.sol          9 fork tests vs. live Aerodrome
```

USDC in → zapped into Aerodrome vAMM-WETH/USDC → LP staked in the gauge → `harvest()` claims AERO, takes the performance fee, swaps to USDC and compounds.

## The venue choice was measured, not assumed

I read the live Base chain rather than picking a DEX by reputation. Summing `Swap` events and reading in-range liquidity across all six USDC/WETH venues gave a result I didn't expect:

| Venue | Volume/day | Full-range LP yield |
|---|---|---|
| Uniswap V3 0.05% | $11.7M | **~2.2% APR** |
| Uniswap V3 0.30% | $22.1M | **~0.9% APR** |
| Aerodrome vAMM | $0.1M | **~4.2% APR** |

The venue with the *least* trading volume is the best home for a full-range position, because its yield isn't trading fees at all — it's gauge emissions, distributed per LP token rather than per unit of concentrated liquidity. Full-range Uniswap positions spread liquidity across every price and capture a tiny slice of fees at the current tick. The fork test confirms the pick end-to-end: **27.2 AERO/day per 100k USDC**, ≈4.1% APR, matching my offchain estimate independently.

Two Aerodrome specifics shaped the code: gauge-staked LPs earn **no trading fees** (they route to veAERO voters), so `harvest()` only claims emissions — asserted onchain by checking the vault's fee credits stay at zero while AERO accrues. And emissions are governance-directed, so the deploy script refuses a dead gauge and `emergencyExit()` can pull out while withdrawals keep working.

## One thing worth your attention

The Aerodrome **CL tick-100** pool on the same pair emits at roughly **58% APR** at the pool level — an order of magnitude above what this v1 earns. I did not build it, because capturing it needs concentrated-range management (range selection, rebalance triggers, oracle-checked repositioning so a rebalance can't be forced at a manipulated price), which is a much larger and riskier build than a first version. But the gap is big enough that it should be planned as the next thing, not filed as someday. It's written up in the README with the caveat that 58% is an upper bound, since CL emissions only accrue to staked in-range liquidity.

## Design notes

Shares are denominated in **LP tokens** with an internal `totalLpManaged` counter, not USDC. No share math ever reads pool reserves, so the share price can't be moved by donations or reserve manipulation (both tested). Users get explicit `minShares`/`minUsdcOut` bounds instead. I skipped ERC-4626 deliberately: `totalAssets()` in USDC would require an oracle-priced LP valuation, whereas LP-denominated shares need no pricing at all.

The one-sided zap uses a closed-form optimal swap with the pool fee read from the factory at call time (Aerodrome fees are governance-settable). A fuzz test from $100 to $500k confirms under 0.2% left idle; measured round-trip cost against the live pool is **0.30%** on a $50k ticket.

The keeper's slippage bound is computed offchain in the script and passed as calldata — if the vault quoted itself during the harvest, a searcher could move the pool and have the check authorize their own price.
