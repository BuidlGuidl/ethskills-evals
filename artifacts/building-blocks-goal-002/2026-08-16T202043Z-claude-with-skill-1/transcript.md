Done. `forge build` exits 0 and all **46 tests pass** (9 math, 29 vault/strategy, 8 live-Base fork).

## What I built

A two-contract ERC-4626 system: `YieldVault` (USDC accounting, 5% idle buffer, cap, pause, exit fee) and `AerodromeVammStrategy` (zap in/out, gauge staking, harvest), plus `VammMath` for valuation, an onchain-verified address book, and a deploy script with gauge preflight checks.

## Venue selection — measured, not assumed

The skill warned against defaulting to a DEX by name, so I read Base directly. Three findings changed the design:

**Harvest means claiming emissions, not fees.** On Aerodrome, staking LP in a gauge *forfeits* trading fees to veAERO voters. I measured an hour of `Swap` logs on the vAMM pool: ~195 swaps but only ~$1.1k of volume, nearly all $5 automated dust → ~0.36% APR from fees, versus **399 bps** from AERO emissions (confirmed live in the fork test). Building `harvest()` the Uniswap way would have captured roughly a tenth of the yield.

**The "43–59% APR" articles describe a different pool.** They refer to the Slipstream concentrated-liquidity pool, whose gauge gets 255,359 AERO/week against the vAMM's 14,615 — 17.5×. I built on the vAMM anyway (full-range, ERC-20 LP, simple gauge; CL needs range selection and a rebalancing policy) and left `IStrategy` as the seam, with a live test tracking the gap.

**The merger has not shipped.** News results claimed a July 2026 migration where old pools stop earning. Onchain, the gauge is alive and emitting now. I handled the risk in code rather than prose: a killed gauge makes the strategy hold LP unstaked instead of reverting, so deposits and withdrawals keep working.

## Two real bugs the tests caught

- **Oracle-mid slippage bounds rejected large deposits.** I was conflating manipulation with my own unavoidable price impact. Split into a pool-vs-oracle deviation guard plus router-quoted min-outs, and added a cap on the strategy's own market impact.
- **The last redeemer could never exit.** `totalAssets()` values the LP at oracle fair price, but liquidating costs fee + impact, so the final redeem reverted permanently — stranding the vault. Fixed with a 50 bps exit fee sized to cover liquidation; `test_lastRedeemerCanAlwaysExit` guards it.

## One thing to decide before deploying

The strategy as specified earns **3.99%** with full ETH exposure and impermanent loss. Supplying the same USDC to Aave V3 on Base currently pays **3.58%** — delta-neutral, no IL. That's ~40 bps for a large amount of risk, and depositors handing over USDC may not expect ETH exposure at all.

I built what you asked and documented the trade rather than narrowing scope. The README leads with it, with commands to reproduce every figure. The two exits are Slipstream (17.5× the emissions, needs CL position management) or a lending strategy behind the same vault — `IStrategy` makes either a contained change.

Also worth noting: the vAMM pool is only ~$7.9M deep, so a full single-transaction exit is safe to about **$55k** at the default exit fee. The deploy script caps deposits at 100k USDC; the README explains how to size that up.
