Done. `forge build` and `forge test` both pass — 49 tests, 0 failures.

## What's built

An ERC4626 USDC vault on Base (`UsdcYieldVault`) plus `SlipstreamUsdcWethStrategy`, which LPs WETH/USDC as a concentrated-liquidity position on Aerodrome Slipstream, stakes the NFT in the pool's CL gauge, and compounds AERO emissions via `harvest()`. Deploy script and README included.

## The venue decision, made from chain state

I checked the actual pair rather than defaulting to a protocol by name. The result overturned the obvious "simple v1" answer:

| Venue | TVL | Weekly AERO |
|---|---|---|
| **Slipstream CL100** | ~$10.5M | **~255,400 (~$104k)** |
| Aerodrome vAMM | ~$7.6M | ~14,620 (~$6.0k) |
| Uniswap V3 0.05% / 0.30% | ~$10.2M / ~$113M | none |

The vAMM pool — fungible ERC20 LP, trivial vault accounting — carries ~5% of this pair's emissions at 73% of the TVL, roughly **12x worse reward density**. `Voter.isAlive()` also ruled out the CL1 gauge, which still reports a non-zero `rewardRate` despite being killed; comparing rates alone would have picked a pool that pays nothing.

## Two things worth flagging

**Gauge-staked Aerodrome LPs don't earn trading fees.** I confirmed this onchain: the gauge accrues `claimable0/1` but forwards them to `feesVotingReward` (veAERO voters). AERO emissions are the *entire* yield, so `harvest()` sells AERO and never expects fee income.

**Range width dominates returns**, and my first default was badly wrong. Measured on a fork with a 100k position: ±49% → 2.1% APR, ±10.5% → 7.6%, ±5.1% → 14.9%, ±2% → 35.8%. I set the default to ±10.5% on that evidence. That experiment also exposed a real bug — my `amountMin` bounds demanded that nearly all of *both* token balances be consumed, which trips the pool's price-slippage check on any non-wide range; now bounded against the amounts actually expected.

Verifying against deployed bytecode rather than remembered interfaces caught two integration errors that would otherwise have shipped: the CL gauge has no `increaseStakedLiquidity` (it's a 1167 clone exposing only deposit/withdraw/getReward/earned), and Slipstream's `mint` takes `tickSpacing` plus a trailing `sqrtPriceX96`.

## Design notes

NAV is priced from Chainlink, never pool spot, so share price can't be moved with a swap; execution runs against the same pool (0.0424% fee), gated on spot being within 2% of the oracle. The WETH leg is marked 0.2% below mid so a 100% redemption is actually payable — without that, `previewRedeem` is optimistic and full exits revert.

Two caveats I'd want you to weigh: the comparison above pits an emissions stream against *zero* emissions, not against Uniswap's fee income — a fee-harvesting Uniswap strategy is a legitimate alternative and needs a routed-volume study to rule out. And the announced Aerodrome→Aero migration (reported July 2026 launch, with LPs needing to move pools to keep earning) is the top operational risk; the gauge is live and emitting at the pinned block, and I added a guarded `migrateStrategy` path since the strategy pins its pool and gauge as immutables. Both are documented in the README, along with the fact that a stale Chainlink feed halts deposits and withdrawals.
