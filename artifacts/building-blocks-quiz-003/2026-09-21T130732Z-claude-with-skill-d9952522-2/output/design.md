# Flash-loan arb bot — design

Borrow 100,000 USDC from Aave V3 (Ethereum mainnet), buy WETH on the cheaper DEX, sell it on the
dearer DEX, repay the loan + fee, keep the rest. All in one transaction: if the sale doesn't return
enough to repay, the whole tx reverts.

## 0. Verified inputs (onchain reads, block 26,026,080, 2026-09-21 13:07 UTC)

| Input | Value | Source |
|---|---|---|
| Aave V3 Pool | `0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2` | — |
| `FLASHLOAN_PREMIUM_TOTAL` | **5 bps (0.05%)** | `Pool.FLASHLOAN_PREMIUM_TOTAL()` |
| `FLASHLOAN_PREMIUM_TO_PROTOCOL` | 100% of premium → Aave treasury | `Pool.FLASHLOAN_PREMIUM_TO_PROTOCOL()` |
| USDC reserve flags | active, not frozen, not paused, flash loans on | `Pool.getConfiguration(USDC)` bits 56/57/60/63 |
| USDC available in Aave | 158.48M USDC | `USDC.balanceOf(aUSDC 0x98C2…6F5c)` |
| DEX A: Uniswap V3 USDC/WETH 0.05% | `0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640`, 83.96M USDC / 8,038 WETH | `fee()`, balances |
| DEX B: Uniswap V2 USDC/WETH 0.30% | `0xB4e16d0168e52d35CaCD2c6185b44281Ec28C9Dc`, 10.58M USDC / 3,867 WETH | `getReserves()` |
| ETH/USD | $2,734.20 | Chainlink `0x5f4e…8419` |
| Base fee | 0.498 gwei | `eth_getBlock` |
| Uni V3 0.05% quote, 100 USDC → WETH | 0.0364897 WETH | QuoterV2 |
| Uni V3 0.05% quote, 100,000 USDC → WETH | 36.4589 WETH | QuoterV2 |

Aave premium is governance-controlled (it has been 9 bps before) — bot must read it onchain, not
hardcode it. Note: premium applies to `flashLoanSimple`; only governance-whitelisted flash borrowers
get it waived — we are not one.

Pair choice: WETH is the intermediate token (deepest USDC pair on both venues). Direction is decided
per-block: buy on whichever pool has the lower mid price. Sushiswap V2 USDC/WETH was checked and
rejected (only 145k USDC liquidity).

## 1. Execution sequence (one tx)

Example: V3 is the cheap side (mid ≈ $2,739.13), V2 is the dear side. Amounts shown at the
**break-even gap** (§3) so the numbers reconcile to ~$0 profit.

| # | Step | Amount in | Amount out |
|---|---|---|---|
| 0 | Off-chain: detect gap, simulate full path with current state, build tx with `minProfit` | — | — |
| 1 | Bot EOA → `ArbExecutor.execute()` → `Pool.flashLoanSimple(USDC, 100,000)` | — | Executor holds **100,000 USDC** |
| 2 | Aave calls `executeOperation(asset, amount, premium=50, …)` on executor; check `initiator == this` and `msg.sender == Pool` | — | debt = **100,050 USDC** |
| 3 | Swap USDC→WETH on Uni V3 0.05% pool (`amountOutMinimum` set) | 100,000 USDC (50 USDC fee, ~84 USDC impact) | **36.4589 WETH** |
| 4 | Swap WETH→USDC on Uni V2 pool (direct `pair.swap`, precomputed `getAmountOut`) | 36.4589 WETH (0.30% fee, ~0.93% impact) | **≈100,051 USDC** at break-even gap |
| 5 | `require(balance ≥ 100,050 + minProfit)` else revert | — | — |
| 6 | Approve Pool for 100,050; return `true`; Aave pulls **100,050 USDC** (50 to treasury) | 100,050 USDC | — |
| 7 | Sweep remainder to owner | ≈1 USDC | = gas paid in step 1 → net ≈ $0 |

Approvals (executor → V3 router, executor → Pool) set once at deploy, not per run.

## 2. Costs per execution (100,000 USDC notional)

| # | Cost | Rate | USD | Notes |
|---|---|---|---|---|
| 1 | Aave flash-loan premium | 0.05% × 100,000 | **50.00** | onchain value, see §0 |
| 2 | DEX A swap fee (Uni V3) | 0.05% × 100,000 | **50.00** | LP fee |
| 3 | DEX A price impact (Uni V3 0.05%) | 0.0845% × 99,950 | **84.43** | from QuoterV2: 100 vs 100k quote |
| 4 | DEX B swap fee (Uni V2) | 0.30% × 99,865.57 | **299.60** | LP fee |
| 5 | DEX B price impact (Uni V2) | ≈ x/(R+x) = 0.932% × 99,565.97 | **928.65** | reserves 10.58M USDC; biggest cost |
| 6 | Gas | 300,000 gas × 1 gwei (0.5 base + 0.5 tip) × $2,734 | **0.82** | 300k is an estimate (flash loan ~90k + V3 swap ~140k + V2 swap ~70k); measure on fork. At 20 gwei: $16.41 |
| | **Total fixed-ish cost** | | **1,413.50** | |

Variable / conditional costs (not in the break-even number):

- **Builder bribe**: arb is competitive; winning usually means paying most of the gross profit to
  the block builder (`coinbase` transfer in a bundle). Set as a % of profit, so it raises the
  real threshold above §3.
- **Reverted tx gas**: if sent via public mempool and front-run, it reverts and still pays ~$0.3–0.8
  gas. Send via private bundle (Flashbots etc.) → failed attempts cost $0.
- **One-time**: executor deploy + 2 approvals ≈ 1.5M gas ≈ $2–4 at current gas.
- Off-chain infra (RPC node, server) — excluded.

## 3. Minimum price gap

Define gap = (dear-pool mid − cheap-pool mid) / cheap-pool mid, expressed in USD on 100k:
`gap_usd = gap × 100,000`. To first order, each 1% of gap adds ~$1,000 to what step 4 returns.

Zero-gap round trip (both pools at the same mid):

```
100,000.00  borrowed
 −   50.00  V3 fee            → 99,950.00
 −   84.43  V3 impact         → 99,865.57
 −  299.60  V2 fee            → 99,565.97
 −  928.65  V2 impact         → 98,637.33   USDC back from swaps
```

Swap loss = 100,000 − 98,637.33 = **1,362.67**

Break-even:

```
gap_usd ≥ swap loss + Aave premium + gas
        = 1,362.67  + 50.00        + 0.82
        = 1,413.49 USD   (≈ 1.41% price gap)
```

**Below ≈ $1,414 (1.41%) gap on 100k, the run loses money** (before any builder bribe).

Sanity check at block 26,026,080: V3 mid ≈ $2,739.13, V2 mid ≈ $2,734.75 → gap ≈ 0.16% ≈ $160,
far below threshold → correctly no trade.

Sensitivity:

| Scenario | Threshold |
|---|---|
| Base (above) | $1,413 |
| Gas at 20 gwei | $1,429 |
| Aave premium back to 9 bps | $1,453 |
| Replace DEX B with Uni V3 USDC/WETH 0.30% pool (`0x8ad5…e6D8`, 18.3M USDC; impact 0.062%) | 50 + 84.43 + 299.60 + 61.42 + 50 + 0.82 = **$546** |

Takeaway: the V2 pool is too shallow for a fixed 100k trade — its price impact alone is ~2/3 of the
cost. Fixed size is a poor fit; the optimal size is where marginal gain = marginal impact, and is
usually well below 100k on V2.

## 4. Safety rules for the contract

- `executeOperation`: require `msg.sender == POOL` and `initiator == address(this)`.
- Only owner can call `execute`; no funds sit in the contract between runs.
- Slippage bounds on both swaps + final `minProfit` check → revert instead of loss.
- Read premium from Pool each run; simulate the full tx (`eth_call`) on the latest block before sending.
- Test on a mainnet fork: happy path, gap vanishes mid-block (must revert), premium change, V2 reserve change.

## Open questions

1. Keep fixed 100k size, or size per-opportunity (lower threshold, more trades)?
2. Swap DEX B to Uni V3 0.30% / Curve / other venue? (threshold $546 vs $1,413)
3. Bribe policy: what % of profit to give builders?
4. Only USDC/WETH, or scan other pairs too?
