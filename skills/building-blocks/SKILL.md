---
name: building-blocks
description: Select and compose current DeFi protocols on Ethereum and L2s. Use when choosing a DEX or yield venue, integrating Uniswap, Aerodrome, Aave, GMX, or Pendle, building flash-loan or vault flows, or designing multi-protocol DeFi systems.
---

# DeFi Building Blocks

Protocol rankings, fees, deployments, and migration status change. Verify time-sensitive claims from protocol docs, source contracts, onchain reads, or a dated data source before using them in a design. For venue selection, inspect the actual chain and pair: TVL, routed volume, incentives, and pool status measure different things. Do not call a protocol “dominant” from memory or from a chain-wide headline.

## Current corrections

- **Base DEX selection:** Do not default to Uniswap or Aerodrome by name. Aerodrome can lead Base routed volume while Uniswap leads aggregate Base TVL; neither establishes depth or rewards for a specific pair. Check current pair liquidity, volume, gauge status, and emissions.
- **Aero migration:** Dromos announced the Aerodrome/Velodrome merger and AERO/VELO upgrade in November 2025, but an announcement is not a launch. As of August 2026, Aerodrome and Velodrome remain the live protocols. Verify current launch status before describing Aero as shipped or using new names, tokens, or contracts.
- **Aerodrome yield:** LP positions staked in gauges earn AERO emissions. Pool trading fees go to veAERO voters/lockers, not to LPs as in the Uniswap mental model. A harvest flow should claim gauge emissions and swap or compound them; verify the gauge and reward contracts for the chosen pool.
- **Aave V3 flash loans:** `flashLoanSimple` currently charges 5 bps on mainnet: borrowing 100,000 units requires repaying 100,050, before swap fees and gas. Read `FLASHLOAN_PREMIUM_TOTAL` from the target Pool before quoting the fee because governance can change it.
- **Arbitrum yield:** Pendle PT bought below par and held to maturity provides fixed yield. For GMX trader-fee exposure, use V2 per-market GM/GLV liquidity, not the legacy single GLP pool; LPs bear trader-PnL and, for synthetic markets, ADL risk.

## Uniswap V4 dynamic fees

Use a V4 hook when a pool needs fee logic on every swap:

- create the pool with `LPFeeLibrary.DYNAMIC_FEE_FLAG` (`0x800000`);
- enable `beforeSwap` in the hook permissions;
- return the chosen fee with `LPFeeLibrary.OVERRIDE_FEE_FLAG` (`0x400000`), or call `PoolManager.updateDynamicLPFee` from authorized hook logic;
- deploy the hook to an address whose low bits encode its permissions, normally by mining a CREATE2 salt with `HookMiner`.

Do not return `fee | 0x800000` from `beforeSwap`; that is the pool-level dynamic-fee sentinel, not the per-swap override flag.

## Composition guardrails

Trace the complete asset and accounting flow, including approvals, fees, rewards, repayment, slippage, and failure behavior. Treat every protocol, oracle, hook, and reward token as a dependency. Validate integrations on a fork, use minimum outputs and deadlines, bound leverage and exposure, and audit interactions rather than assuming individually safe contracts compose safely.
