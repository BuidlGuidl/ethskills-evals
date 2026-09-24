# USDC Yield Vault on Base — Design

Status: draft, pre-code. Any number marked **(verify)** must be checked onchain before deploy.

## 1. Summary

Users deposit USDC. The vault swaps part of it into a second stablecoin, adds liquidity to an
**Aerodrome stable (sAMM) pool**, and **stakes the LP token in that pool's gauge** (the contract
that pays out AERO rewards). A keeper calls `harvest()`, which claims AERO from the gauge, sells it
for USDC, and adds it back into the position.

Vault shares follow ERC-4626 (standard tokenized-vault interface). `totalAssets()` = value of staked
LP, priced in USDC, plus idle USDC.

## 2. Which pool, and why

**Pick: Aerodrome sAMM pool, USDC / <second USD stablecoin>, staked in its Aerodrome gauge.**

Why Aerodrome:
- It's the main DEX on Base by liquidity and volume, and most Base pools that pay LP incentives
  pay them through Aerodrome gauges.
- Contracts are a Velodrome V2 fork: simple, audited, widely integrated.

Why a stable (sAMM) pool, not volatile (vAMM) or concentrated liquidity (Slipstream):
- Depositors hold USDC and expect USDC back. Pairing with another USD stablecoin keeps
  impermanent loss (value lost vs. just holding, when the two prices move apart) near zero, as long
  as both coins hold their peg. USDC/WETH would expose depositors to ETH price moves.
- Basic sAMM positions are fungible ERC-20 LP tokens. No price ranges, no NFTs, no rebalancing.
  Slipstream (Aerodrome's concentrated-liquidity version) often has higher reward rates, but needs
  range management logic and a rebalancing keeper — too much for a small vault v1.

Choosing the second token — must pass all of these at deploy time:
1. `PoolFactory.getPool(USDC, X, true)` returns a pool.
2. `Voter.gauges(pool)` is non-zero and `Voter.isAlive(gauge)` is true.
3. Pool has meaningful votes/emissions this epoch (check gauge `rewardRate()`), and the choice isn't
   driven by one week's spike.
4. X is a native (not legacy-bridged) USD stable with deep liquidity. Avoid USDbC — it's the old
   bridged USDC being wound down, so its pool emissions and liquidity are shrinking.
5. Candidates to evaluate: USDT, DAI/USDS, other major USD stables with a live gauge. **(verify)**

Pool address is set in the constructor (not hardcoded in logic), gauge is read from `Voter.gauges(pool)`.

### Key addresses (Base) **(verify all before deploy)**

| Contract | Address |
|---|---|
| USDC (native) | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| AERO | `0x940181a94A35A4569E4529A3CDfB74e38FD98631` |
| Aerodrome Router | `0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43` |
| Aerodrome PoolFactory | `0x420DD381b31aEf6683db6B902084cB0FFECe40Da` |
| Aerodrome Voter | `0x16613524e02ad97eDfeF371bC883F2F5d6C480A5` |
| Pool / Gauge | chosen per criteria above; gauge = `Voter.gauges(pool)` |

## 3. Important: what a staked Aerodrome LP does and does NOT earn

Aerodrome uses a ve(3,3) model (people lock AERO as veAERO and vote on which pools get rewards):

- **Staked LP (in gauge): earns only AERO emissions.** The pool's trading fees go to the gauge,
  which forwards them to `FeesVotingReward` — i.e. to **veAERO voters**, not to LPs.
- **Unstaked LP: earns trading fees** (claimable via `pool.claimFees()`), but **no AERO**.

You can't have both. On Aerodrome, for gauge pools, emissions are almost always far larger than
fees, so the vault stakes. So:

- The vault earns **zero swap fees**. Don't call `pool.claimFees()` in harvest — it would return ~0
  for staked LP and just waste gas.
- The only reward is **AERO**, and the only place it's claimed is the **Gauge**.

## 4. `harvest()` flow

Caller: keeper only (`onlyKeeper`). Inputs: `minUsdcOut` (min USDC from selling AERO), `minLpOut`
(min LP tokens minted) — the keeper computes both offchain from current prices minus slippage
tolerance, so a price-manipulated block makes the harvest revert instead of losing funds.

```
harvest(minUsdcOut, minLpOut):
  1. gauge.getReward(address(this))
       - Contract: the pool's Gauge (Voter.gauges(pool))
       - Claims: AERO accrued to the vault since last claim
       - Note: getReward(account) only works when msg.sender == account (or Voter),
         so the vault must call it itself.
  2. aero = AERO.balanceOf(this); if aero < minHarvest: return   // skip dust, save gas
  3. Router.swapExactTokensForTokens(aero, minUsdcOut,
         routes=[{from: AERO, to: USDC, stable: false, factory: PoolFactory}], this, deadline)
       - Sells AERO via the AERO/USDC volatile pool (deepest AERO market on Base) (verify)
  4. fee = usdcOut * perfFeeBps / 10_000; transfer fee to treasury
  5. Split remaining USDC into USDC + X in the ratio the pool wants:
       - Use Router.quoteAddLiquidity to get ratio; swap needed USDC -> X
         through the same sAMM pool (stable: true)
  6. Router.addLiquidity(USDC, X, stable=true, amtA, amtB, minA, minB, this, deadline)
       - returns lp; require(lp >= minLpOut)
  7. gauge.deposit(lp)          // stake new LP so it starts earning AERO immediately
  8. emit Harvested(aero, usdcOut, fee, lp)
```

Notes:
- `deposit()` for users runs steps 5–7 on their USDC; `withdraw()` does `gauge.withdraw(lp)` →
  `Router.removeLiquidity` → swap X back to USDC.
- Leftover dust of USDC/X after `addLiquidity` stays idle in the vault and gets included next harvest.
- Rewards accrue to the vault continuously; harvesting doesn't change what's earned, only how
  often it compounds. It does move share price in a step, so a user could deposit right before
  harvest and capture yield they didn't earn. Mitigate: harvest often (cheap on Base), or
  release harvested profit linearly over a few hours (like Yearn's `profitUnlockTime`).
- Frequency: daily is plenty. Base gas is cents, but AERO→USDC slippage on small amounts and
  compounding at stable yields make hourly pointless.

## 5. Realistic earnings breakdown

### Where the yield comes from

| Source | Earned by vault? | Notes |
|---|---|---|
| Pool swap fees | **No** | Go to veAERO voters because LP is staked |
| AERO emissions | **Yes — 100% of gross yield** | Paid by the gauge, amount set by votes each epoch |
| Bribes / voting rewards | No | Only for veAERO holders; vault holds no veAERO |
| Compounding | Small | Only matters on emissions, see below |

### How to compute the AERO APR

```
vaultAeroPerYear = gauge.rewardRate() * 365 days * vaultStaked / gauge.totalSupply()
grossAPR         = vaultAeroPerYear * AERO_price_usd / vaultTVL_usd
```

`rewardRate` resets every weekly epoch (Thursday 00:00 UTC) based on that week's votes, so the APR
shown today is only good for the current week.

### Illustrative example — $100k TVL (numbers are placeholders, **verify** live)

Stable-pool gauge APRs on Aerodrome typically move in a wide band (low single digits to
low double digits), depending on votes and AERO price. Take a mid case:

| Line item | Annual | Note |
|---|---|---|
| Gross AERO emissions (8% APR at current AERO price) | $8,000 | Main driver, can halve if votes leave or AERO drops |
| Swap fees | $0 | Staked LP gets none |
| Slippage + 0.3% pool fee selling AERO → USDC | −$40 to −$100 | Daily harvests of ~$22 of AERO |
| Swap USDC → X on each harvest (0.05% stable fee, stable default (verify)) | −$2 | Tiny |
| Keeper gas (~365 txs × ~$0.01–0.05 on Base) | −$5 to −$20 | Negligible |
| Performance fee (10%, example) | −$790 | Vault's cut, taken on harvest |
| Compounding gain (daily vs. none) | +~$300 | 8% → ~8.3% APY |
| **Net to depositors** | **~$7,400 (~7.4% APY)** | |

Entry/exit costs (one-time, per user, not in the table): swapping ~half the deposit into X and back
on exit, ~0.05% each way plus slippage.

### Risks that eat into this

- **AERO price**: yield is paid in AERO; if AERO falls 50%, dollar APR falls 50%. Sell on every
  harvest — don't hold AERO.
- **Vote shifts**: emissions follow votes weekly. A pool can go from 10% to 2% in one epoch.
  Keeper/ops should watch `rewardRate` and have a plan to migrate pools (owner-only, with timelock).
- **Dilution**: more LPs staking in the same gauge = same AERO split more ways.
- **Depeg**: if X loses its peg, the sAMM pool fills with X and the vault ends up holding the
  depegged coin. This is the real principal risk. Pick X carefully; consider an owner "emergency
  exit" that unstakes and withdraws to USDC.
- **Gauge killed**: governance can kill a gauge (`Voter.isAlive` → false); emissions stop.
- **Sandwich on harvest**: covered by keeper-supplied `minUsdcOut` / `minLpOut`.
- **Smart contract risk**: vault + Aerodrome + both stablecoins.

## 6. Open questions

1. Which second stable (X)? Need to check live gauges/liquidity against section 2 criteria.
2. Performance fee % and treasury address?
3. Linear profit unlock, or just frequent harvests?
4. Want an owner-controlled pool migration path in v1, or fixed pool?
5. Is Slipstream (higher APR, range management) a v2 goal?
