Done. `forge build` and `forge test` both pass — 64 tests, no network needed.

## What's there

**`YieldVault.sol`** — ERC-4626 over USDC. Deposits sit idle in the vault; only a keeper's `earn()` moves them into the strategy, so no user transaction is ever forced to swap into a pool an attacker just imbalanced. `harvest()` compounds and mints the performance fee as shares.

**`AerodromeUsdcWethStrategy.sol`** — zaps USDC into the Aerodrome volatile USDC/WETH pool, stakes the LP in the gauge, sells claimed AERO and re-adds it.

**`FairLpValuation.sol`** — the piece I'd flag for review first. Pricing the LP off the pool's own reserves would make the share price flash-loan manipulable, so `totalAssets()` uses Chainlink ETH/USD ÷ USDC/USD with fair-reserve math (`2·√(k·p₀·p₁)`). A swap can't change `k`, so imbalancing the pool doesn't move the share price — tested by pushing 1M USDC through the pool and asserting <10 bps drift.

Tests run against a real constant-product AMM mock (fees, reserves, `k` checks), not stubs, so the zap, slippage bounds and valuation are genuinely exercised.

## Two things worth your attention

**A bug the tests initially missed.** My suite covered `deposit()` but not `mint()`. `mint()` was fully broken in the default uncapped configuration — `maxMint` tried to convert near-`type(uint256).max` headroom into shares and overflowed, and OZ's `mint()` calls `maxMint` on every invocation. Fixed with a short-circuit, plus three regression tests.

**A design change the tests forced.** I originally used one `maxSlippageBps` for both the end-to-end value check and per-swap `amountOutMin`. That conflated two different questions and rejected healthy operations: zapping a large deposit legitimately moves the pool ~1% off the oracle, and most of that impact is recovered the moment we hold the LP. Split into `maxSlippageBps` (1%, end-to-end — the real protection) and `maxSwapDeviationBps` (2%, per-leg defence in depth).

## Caveats

- The Base addresses in `script/Deploy.s.sol` need verification before a real deploy — particularly `POOL` and `GAUGE`, since Aerodrome retires gauges and multiple USDC/WETH pools exist. The strategy constructor re-checks the relationships on-chain, so a wrong address reverts rather than deploying something broken. I couldn't fork-test these (no Base RPC configured), so they're compile-verified only.
- Impermanent loss is unhedged — that's the strategy's fundamental risk, and no contract-level care removes it.
- Chainlink downtime freezes deposits *and* withdrawals. Deliberate: a frozen vault is recoverable, a mispriced one isn't.
- The keeper is trusted for the AERO sale bound (no AERO feed). Bounded to one swap; they can't withdraw.

Full list in the README's "Known limitations", along with the reasoning for choosing Aerodrome over Uniswap V3 and the keeper runbook.
