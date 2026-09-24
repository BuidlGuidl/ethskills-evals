# USDC Yield Vault on Base — Design

Status: draft, pre-code. All numbers are onchain reads / DefiLlama snapshots taken
**2026-09-21 ~13:03 UTC, Base block 51,603,238**. Re-check before deploying — gauge
emissions change every weekly epoch.

## 1. Pool choice

**Aerodrome v1 volatile pool WETH/USDC (vAMM, 0.30% fee)**

| Contract | Address | Verified how |
|---|---|---|
| Pool (LP token) | `0xcDAC0d6c6C59727a65F871236188350531885C43` | `PoolFactory.getPool(WETH, USDC, false)` |
| Gauge | `0x519BBD1Dd8C6A94C46080E24f316c14Ee758C025` | `Voter.gauges(pool)`; `Voter.isAlive(gauge) = true`; `gauge.stakingToken() = pool` |
| FeesVotingReward | `0x14df87824a11DC27afF185D3149E05aaa4735f60` | `gauge.feesVotingReward()` |
| PoolFactory | `0x420DD381b31aEf6683db6B902084cB0FFECe40Da` | `Router.defaultFactory()`; `getFee(pool,false) = 30` bps |
| Voter | `0x16613524e02ad97eDfeF371bC883F2F5d6C480A5` | `Router.voter()` |
| Router | `0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43` | |
| AERO | `0x940181a94A35A4569E4529A3CDfB74e38FD98631` | `gauge.rewardToken()` |
| AERO/USDC vAMM (sell route) | `0x6cDcb1C4A4D1C3C6d054b27AC5B77e89eAFb971d` | `getPool(AERO, USDC, false)` |

Pool state: 1,661.7 WETH + 4,543,123 USDC ≈ **$9.08M TVL**; 98.7% of LP supply is staked in the gauge.

Why this one:
- **Live gauge with AERO emissions** — the thing `harvest()` compounds.
- **Fungible ERC-20 LP, full range** — no tick ranges, no rebalancing keeper, no NFT
  accounting. Right complexity for a small vault.
- **Blue-chip counter-asset** (WETH), not a small-cap token or a third-party stablecoin.
- Deepest USDC pair on Aerodrome v1 apart from USDC/AERO.

Rejected:
- **Slipstream WETH/USDC (CL50/CL100)** — higher headline APR, but concentrated
  liquidity needs active range management; out of range = earns nothing. Later version, maybe.
- **Uniswap v3/v4 WETH/USDC** — no gauge, fees only; nothing to "harvest and compound" in the reward sense.
- **USDC/AERO** — half the position in the reward token itself; doubles AERO exposure.
- **USDC/MAI, USDC/msUSD, USDC/eUSD stable pools** — low IL, but depeg risk on the partner
  stablecoin and near-zero volume.

## 2. harvest() flow

### Key fact: staked LPs earn AERO only, not trading fees

In Aerodrome, once LP is deposited into the gauge, the **gauge** is the LP holder. The
pool's trading fees accrue to the gauge, which forwards them to `FeesVotingReward` on each
epoch's `notifyRewardAmount` (`Gauge._claimFees()` → `IReward(feesVotingReward).notifyRewardAmount`,
see `contracts/gauges/Gauge.sol` in aerodrome-finance/contracts). Those fees go to **veAERO
voters**, not to us. So the vault claims **exactly one thing: AERO, from the Gauge**.

Do not add a `pool.claimFees()` step — the vault holds no unstaked LP, so it would return ~0.
DefiLlama shows `apyBase + apyReward` for this pool; a staked vault gets only `apyReward`.

### Steps (keeper-only, `nonReentrant`)

1. `Gauge(0x519B…C025).getReward(address(this))` → vault receives AERO.
   (`getReward` requires `msg.sender == account`, so the vault itself must call it.)
2. If AERO balance < `minHarvest`, stop (avoid dust swaps).
3. Swap AERO → USDC via Router, route `[AERO → USDC, stable=false]` through the AERO/USDC vAMM.
   `amountOutMin` from the pool's built-in TWAP (`pool.quote(AERO, amt, granularity)`) minus
   max slippage (e.g. 1%). Never trust spot price — harvest is sandwichable.
4. Take performance fee in USDC → treasury.
5. Swap the optimal fraction of USDC → WETH (slightly under 50%, accounts for the 0.3% fee)
   so the add is balanced. Same TWAP-based `amountOutMin`.
6. `Router.addLiquidity(WETH, USDC, false, …, amountAMin, amountBMin, vault, deadline)` → LP.
7. `Gauge.deposit(lpAmount)` → staked. Share price rises; no new shares minted.
8. Leftover dust (WETH/USDC) stays in the vault and is folded into the next harvest.

### Deposit / withdraw (for context)
- Deposit USDC → swap part to WETH → `addLiquidity` → `gauge.deposit` → mint shares.
- Withdraw → `gauge.withdraw` → `removeLiquidity` → swap WETH → USDC → return USDC.
  Each side costs ~0.15% (0.3% fee on half the value) plus slippage.

### Timing
- Emissions stream linearly within an epoch (Thu 00:00 UTC → next Thu). Current epoch ends
  `periodFinish = 1790208000` (2026-09-24 00:00 UTC).
- On Base, gas per harvest is cents, so **daily** harvest is fine. More frequent adds little.
- If `Voter.isAlive(gauge)` turns false (gauge killed), emissions stop. Harvest what's earned,
  then governance/guardian decides to migrate.

## 3. What the position actually earns

### Emissions (the only thing the vault receives)
- `gauge.rewardRate()` = 0.029588 AERO/s → **17,895 AERO/week ≈ 933k AERO/yr**.
- AERO = **$0.698** (DefiLlama; AERO/USDC pool TWAP agrees at ~$0.689–0.695).
- ≈ $651k/yr ÷ $8.97M staked TVL = **~7.3% APR in AERO**, right now.
- Last 30 days (DefiLlama): **4.7% – 9.6%**. It swings every epoch with veAERO votes and AERO price.

### Trading fees (earned by the pool, **not** by the vault)
- Measured from the pool's fee accumulators (`index0/index1`) over the last ~7 days
  (302,400 blocks): 2.32 WETH + 6,320 USDC ≈ **$12.7k/week ≈ 7.3% APR**.
- The staked share of this goes to veAERO voters. Note: an *unstaked* LP currently earns about
  the same in fees as a staked one earns in AERO. Staking wins when emissions > fees;
  that's not guaranteed every week.
- DefiLlama's `apyBase` for this pool (0.99%) doesn't match the onchain accumulators — don't use it.

### Worked example: $100k vault, 1 year, today's rates held flat
| Item | $/yr |
|---|---|
| Gross AERO (7.18% after our own dilution of the gauge) | +7,180 |
| AERO → USDC swap (0.3% fee, negligible impact vs $36M pool) | −22 |
| USDC → WETH on compounding (~0.15% of harvest) | −11 |
| Performance fee (assume 10%) | −718 |
| Keeper gas (daily, Base) | ~−20 |
| **Net, daily compounding** | **≈ +6,400 (~6.4% APR / ~6.6% APY)** |
| Entry + exit swaps (one-time) | ~−300 (0.3%) |

### The big one: this is not a USDC yield
Half the position is WETH. In USDC terms a constant-product LP is worth `√r` of the start
value, where `r` = ETH price change:

| ETH move | LP value in USDC | vs. just holding 50/50 (IL) |
|---|---|---|
| −50% | −29.3% | −5.7% |
| −25% | −13.4% | −1.0% |
| +25% | +11.8% | −0.6% |
| +50% | +22.5% | −2.0% |
| +100% | +41.4% | −5.7% |

A ~7% yield is erased by a ~15% ETH drop. Users depositing USDC must be told they are taking
ETH price exposure and IL. Reward-side risk too: AERO price and vote share can drop week to week.

## 4. Before coding
- Fork test (Base fork) full deposit → harvest → withdraw; assert TWAP min-out reverts on a
  manipulated pool; test killed-gauge path; test first-depositor / share-inflation attack.
- Re-read all addresses and `rewardRate` at deploy time.

## Unresolved questions
- OK with ETH exposure, or do you actually want USDC-stable yield (would change pool choice
  entirely — e.g. lending market, or a stable/stable pool)?
- Performance fee %, treasury address?
- Stake always, or let the vault toggle staked vs unstaked depending on emissions vs fees?
  (Adds complexity; recommend always-staked for v1.)
- Keeper: own bot, Gelato, or Chainlink Automation?
