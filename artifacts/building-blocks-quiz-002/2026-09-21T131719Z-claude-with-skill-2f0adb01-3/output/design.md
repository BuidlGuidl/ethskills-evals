# Aerodrome USDC/WETH Auto-Compounding Vault — Design

## TL;DR

- Vault holds Aerodrome USDC/WETH **volatile** pool LP tokens, **staked in the pool's Gauge**.
- `harvest()` claims **AERO emissions** from the **Gauge** (`Gauge.getReward`). That's the only reward stream.
- The position earns **no swap fees**. Once LP is staked in the gauge, the pool's fees go to **veAERO voters** of that pool, not to us.
- Real yield = AERO emissions APR − AERO sell slippage − keeper gas − impermanent loss.

Aerodrome works the opposite way from Uniswap: LPs get emissions, voters get fees. The whole design follows from that.

> Branding: Aerodrome and Velodrome merged under the "Aero" brand (Dromos Labs, Nov 2025). Base contracts and the ve(3,3) model are the same. This doc says "Aerodrome".

---

## 1. Contracts (Base)

| Role | Address / how to get it |
|---|---|
| Router | `0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43` |
| PoolFactory | `0x420DD381b31aEf6683db6B902084cB0FFECe40Da` |
| Voter | `0x16613524e02ad97eDfeF371bC883F2F5d6C480A5` |
| AERO | `0x940181a94A35A4569E4529A3CDfB74e38FD98631` |
| USDC (native) | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| WETH | `0x4200000000000000000000000000000000000006` |
| USDC/WETH pool | `PoolFactory.getPool(USDC, WETH, false)` (`stable = false`) |
| Gauge | `Voter.gauges(pool)` |
| FeesVotingReward | `Voter.gaugeToFees(gauge)` (for reference; the vault never calls it) |

Resolve pool and gauge at deploy time from the factory and Voter. Don't hardcode them. Check `Voter.isAlive(gauge)` before depositing. A killed gauge stops emitting.

**Scope:** this is the classic (v2-style) volatile pool. Aerodrome also has **Slipstream** (concentrated liquidity) USDC/WETH pools with `CLGauge`s and NFT positions. Fees and emissions split the same way there, but the vault would also need range management. Not covered here.

---

## 2. Deposit / withdraw

- `deposit`: take LP tokens (or zap USDC → half to WETH → `Router.addLiquidity`) → `Gauge.deposit(lpAmount)`.
- `withdraw`: `Gauge.withdraw(lpAmount)` → send LP (or remove liquidity and return tokens) to the user.
- `totalAssets()` = `Gauge.balanceOf(vault)` + idle LP in the vault. **Don't count pending AERO** (`Gauge.earned`). Its value depends on a spot price, which can be manipulated.

---

## 3. `harvest()` flow (exact)

```
keeper → Vault.harvest(minLpOut)
  1. Gauge.getReward(address(this))
       - gauge sends accrued AERO to the vault
       - must be called by the vault itself (gauge reverts if msg.sender != account && != voter)
  2. take protocol fee in AERO (optional, e.g. 5–10%) → treasury
  3. Router.swapExactTokensForTokens:
       AERO → USDC   (route: AERO/USDC volatile pool)
       then split: ~half USDC → WETH (USDC/WETH volatile pool)
       - amountOutMin from a TWAP/oracle, NOT from a spot quote in the same tx
  4. Router.addLiquidity(USDC, WETH, stable=false, ...) → LP tokens
       - leftover dust stays in the vault for the next harvest
  5. Gauge.deposit(newLp)
  6. require(newLp >= minLpOut); emit Harvested(aeroClaimed, newLp)
```

What it claims: **AERO only**, from **the Gauge only**.
What it does **not** claim:
- Swap fees. They don't go to the vault (see §5). `Pool.claimFees()` returns ~0 for us, since all our LP sits in the gauge.
- Bribes / fee rewards. Those go to veAERO voters through `FeesVotingReward` / `BribeVotingReward`. We don't vote.

### Emission timing
- Epochs are weekly and flip **Thursday 00:00 UTC**. `Voter.distribute(gauge)` sets the gauge's new `rewardRate`. Anyone can call it, so the keeper should call it right after the flip if nobody else has.
- AERO streams linearly over the epoch. The only thing to optimize is how often to harvest: often enough to compound, but not so often that gas and slippage eat the gain. On Base, gas is cents, so a daily harvest is reasonable. Rule of thumb: harvest when `earned × price > ~20× (gas + expected slippage)`.

### Harvest sandwich / share-price jump
Harvesting raises `totalAssets` in one step. Someone could deposit right before a harvest and withdraw right after to grab yield they didn't earn. Mitigations:
- linear profit unlock: book the harvested LP as "locked profit" that releases over ~6–24h (Yearn V3's `profitMaxUnlockTime` pattern), and/or
- harvest frequently so each step is small.

---

## 4. What the position earns (realistic breakdown)

| Source | Goes to vault? | Notes |
|---|---|---|
| AERO emissions | **Yes** (only income) | Size set by how many veAERO votes the pool gets each epoch |
| Pool swap fees | **No** | Go to the pool's veAERO voters |
| Bribes | **No** | Go to veAERO voters |
| LP token appreciation from fees | **No** | Aerodrome pools send fees to a separate `PoolFees` contract, not into the reserves, so LP value doesn't grow from fees the way Uni V2 LP does |

### Gross APR (compute on-chain, don't quote a fixed number)

```
emissionAPR = Gauge.rewardRate() * 365 days * priceAERO
              / (Gauge.totalSupply() * priceLP)
```

Recompute this every epoch. It changes every Thursday with votes, and every day with the AERO price.

### Net APR — what users actually get
```
net ≈ emissionAPR
      × (1 − protocolFee)
      × (1 − AERO sell slippage/MEV)   // AERO → USDC/WETH
      − keeper gas                     // small on Base
      − impermanent loss               // biggest hidden cost
      + compounding bonus              // small at daily frequency
```

Things that make the real number lower than the headline gauge APR:
- **Emissions are paid in AERO and we sell every harvest.** The APR is quoted in AERO at today's price. Constant sell pressure from farms like ours tends to push that price down. Our real return is what we get in USDC/WETH after the swap.
- **Impermanent loss (value lost vs. just holding the two tokens) on USDC/WETH is real.** The volatile pool uses x·y=k. A 2× move in ETH costs ~5.7% vs. holding. A ±50% move costs ~2–6%. In a volatile year IL can eat most or all of the emission APR. Show users a "vs. hold" metric, not just the share price.
- **Dilution.** If more LPs join the gauge and votes stay flat, APR drops pro rata.
- **Votes move.** Emissions follow votes, and votes follow fees plus bribes. If USDC/WETH volume moves elsewhere (e.g. to the Slipstream pools), votes, and our emissions, follow.

**Illustrative only** (not a forecast): gauge shows 20% emission APR → minus 10% protocol fee → 18% → minus ~1% sell slippage/price drift → ~17.8% → with ETH ±40% over the year, IL ~2–4% → **~14–16% net vs. holding**, paid out as more LP, before any AERO price decline.

---

## 5. Where the pool's swap fees end up

Path for fees on our liquidity:

1. Every swap in the pool charges a fee (volatile pool default 0.30%, set per pool in the factory). The fee goes to the pool's `PoolFees` contract, not into the reserves.
2. Fees are credited to LP-token holders pro rata. **Our LP tokens are held by the Gauge**, so the Gauge is the holder that gets credited, not the vault.
3. When the epoch is distributed (`Voter.distribute` → `Gauge.notifyRewardAmount`), the Gauge calls `Pool.claimFees()` and forwards the USDC + WETH to the pool's **`FeesVotingReward`** contract.
4. veAERO holders who voted for this pool claim those fees (plus bribes) after the epoch ends, in proportion to their votes.

So in this design **100% of the swap fees our liquidity earns go to veAERO voters**. That's the trade: LPs give up fees in exchange for AERO emissions.

### Options if we want the fees back (not in v1)
- **Don't stake:** keep LP unstaked and call `Pool.claimFees()`. We'd get fees but no emissions. For this pool, emissions are usually far bigger than fees, so this is worse.
- **Become a voter:** lock part of the harvested AERO into veAERO (`VotingEscrow.createLock`, max 4 years) and vote for USDC/WETH each epoch. We'd get back a share of fees + bribes, and our votes increase our own gauge's emissions. This adds a lot: an illiquid locked NFT, weekly `Voter.vote`/`poke`, and claiming from `FeesVotingReward`/`BribeVotingReward`. Save it for a v2 design.

---

## 6. Risks / checks

- Gauge killed (`isAlive == false`) → stop depositing, keep allowing withdrawals, pause harvest.
- Oracle-based `amountOutMin` on every swap. The keeper passes `minLpOut`. Never use `amountOutMin = 0`.
- `harvest()` limited to the keeper role, or open to anyone but with a strict oracle-based min-out.
- Emergency `Gauge.withdraw` all → hold LP in the vault.
- Dependencies: Aerodrome Pool, Gauge, Voter, Router, and the AERO price. Each one is a risk to the vault.

## Unresolved questions

1. Vault asset: LP token (simple) or USDC with a zap (better UX, more swap risk)?
2. Protocol fee size and recipient?
3. Which oracle for AERO/USDC and ETH/USDC min-out (Chainlink ETH/USD + AERO TWAP)?
4. v2 path: veAERO locking to recapture fees, yes or no?
