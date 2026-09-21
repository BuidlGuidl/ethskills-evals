# USDC Yield Vault on Base — Design

Status: draft, pre-code. Addresses and numbers here must be checked onchain before deploy (see "Before deploy" checklist).

## 1. Summary

- Users deposit USDC into an ERC-4626 vault, get shares back.
- Vault puts the USDC into a **stable pool on Aero (formerly Aerodrome)**, the main DEX on Base, and **stakes the LP token in that pool's gauge**.
- Keeper calls `harvest()`: claims **AERO** from the **gauge**, sells it for USDC, adds liquidity again, stakes again.
- Share price (`totalAssets / totalSupply`) goes up with each harvest.

## 2. Which pool, and why

### Pick: Aero classic **stable** pool (`sAMM`), USDC / another major USD stablecoin, with a live gauge

Final pair is picked with the checklist below. Candidates: USDC paired with a widely held USD stablecoin that has an active gauge (e.g. USDT, USDS/DAI, other majors). Do **not** pick bridged USDbC — it's being phased out and liquidity keeps leaving.

Why this pool type:

| Choice | Why |
|---|---|
| **Aero, not Uniswap** | Aero is the biggest DEX on Base and the only one paying large liquidity rewards (AERO emissions). Uniswap on Base pays only swap fees, and stable-to-stable fees (0.01% tier) are small. |
| **Stable pair, not USDC/WETH** | Users deposit USDC and expect USDC back. A volatile pair adds impermanent loss (value lost when the two token prices move apart), which can wipe out the rewards. A stable pair keeps that loss near zero unless one coin loses its peg. |
| **Classic pool (`sAMM`), not Slipstream (concentrated liquidity)** | Classic pool = one fungible LP token, no price range to manage, no rebalancing keeper. Slipstream earns more per dollar but needs range management — overkill for a small vault. Possible v2. |
| **Staked in gauge** | Unstaked LP earns only swap fees; staked LP earns AERO emissions. Emissions are most of the yield (see §4). |

### Pool selection checklist (run before deploy, re-check each epoch)

1. `PoolFactory.getPool(USDC, X, true)` returns a pool (`stable = true`).
2. `Voter.gauges(pool)` is non-zero and `Voter.isAlive(gauge)` is true. A killed gauge pays nothing.
3. Gauge has meaningful votes for several past epochs (not a one-week bribe spike).
4. Paired stablecoin: deep liquidity, trusted issuer, no recent depeg.
5. Enough liquidity in AERO → USDC route to sell harvests with low slippage.

### Addresses (Base, verify before use)

| What | Address |
|---|---|
| USDC (native) | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| AERO | `0x940181a94A35A4569E4529A3CDfB74e38FD98631` |
| Aero Router | `0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43` |
| Aero PoolFactory | `0x420DD381b31aEf6683db6B902084cB0FFECe40Da` |
| Aero Voter | `0x16613524e02ad97eDfeF371bC883F2F5d6C480A5` |
| Pool / Gauge | from checklist steps 1–2 (read from factory/Voter, don't hardcode from docs) |

## 3. `harvest()` flow

### Key point: how Aero pays LPs

Aero works the **opposite way from Uniswap**:

- **Staked LPs earn AERO emissions — not swap fees.**
- Swap fees from a pool with a gauge go to **veAERO voters** (people who lock AERO and vote), together with bribes.
- So the vault claims **only AERO, only from the gauge**. It does **not** call `pool.claimFees()`: while LP tokens sit in the gauge, the gauge owns the fees and sends them to the voters' fee reward contract. Calling `claimFees` from the vault returns nothing.

### Steps

```
harvest(uint256 minUsdcOut)  — onlyKeeper, nonReentrant
```

1. **Claim** — `IGauge(gauge).getReward(address(this))`
   → vault receives AERO. Source contract: **the pool's Gauge** (the Voter sends emissions to the gauge each epoch; the gauge pays them out over the week).
2. **Sell AERO → USDC** — `Router.swapExactTokensForTokens(aeroBal, minOut, route, vault, deadline)`, route `AERO → USDC` on a volatile (`stable = false`) pool, factory = PoolFactory.
   - `minOut = max(minUsdcOut from keeper, oracle price × (1 − maxSlippage))`. Never set min to 0 or trust the spot price — a front-running bot can move the price in the same block and take the value (sandwich attack).
   - Price reference: Aero pool's time-weighted price (`pool.quote(...)`) or a Chainlink feed if one exists for AERO on Base.
   - Skip the harvest if AERO balance is below a minimum (gas and slippage cost more than it's worth).
3. **Performance fee** — send `fee% × usdcOut` to treasury (e.g. 10%).
4. **Get the paired token** — swap part of USDC to token X on the same stable pool, sized to match pool reserves (`Router.quoteAddLiquidity`). Leftover dust stays in the vault and counts in `totalAssets`.
5. **Add liquidity** — `Router.addLiquidity(USDC, X, true, ...)` with min amounts → LP tokens.
6. **Stake** — `IGauge(gauge).deposit(lpAmount)`.
7. Emit `Harvest(aeroClaimed, usdcFromSale, fee, lpAdded)`.

### Timing

- Aero epochs are weekly (start Thursday 00:00 UTC). Emissions stream continuously during the epoch, so harvest any time.
- Gas on Base costs cents → daily harvest is fine. Increase frequency only if the extra compounding beats the swap costs.

### Deposits / withdrawals (short)

- `deposit`: USDC → swap part to X → addLiquidity → `gauge.deposit`.
- `withdraw`: `gauge.withdraw` → `removeLiquidity` → swap X → USDC → send.
- `totalAssets()` = staked LP valued in USDC + idle USDC. Value LP from reserves checked against an oracle, **not** raw spot reserves — spot reserves can be pushed around with a flash loan to inflate share price (classic vault exploit).
- Unclaimed AERO is **not** counted in `totalAssets` — it only counts after harvest. Means share price jumps at harvest; see open question on deposit timing.

## 4. What the position earns (realistic)

### Income sources

| Source | Does the vault get it? |
|---|---|
| AERO emissions from gauge | **Yes — the only real income.** |
| Pool swap fees | **No** — go to veAERO voters while staked. |
| Bribes | **No** — go to voters. |
| Price gain on stablecoins | ~0 (stable pair). |

### How to compute gross APR (from chain, at launch)

```
emissionsUSD/yr = gauge.rewardRate() × 31_536_000 × AERO price
stakedTVL_USD   = gauge.totalSupply() × LP price
grossAPR        = emissionsUSD/yr / stakedTVL_USD
```

`rewardRate` is reset each epoch from voting results, so this is a **one-week snapshot**, not a promise.

### Illustrative example (made-up numbers, replace with live data)

Assume gauge gets 20,000 AERO/week, AERO = $1.00, staked TVL = $10M.

| Line | APR |
|---|---|
| Gross AERO emissions (20k × 52 / 10M) | 10.4% |
| AERO → USDC sale slippage + swap fee (~0.5%) | −0.05% |
| Pool swap fee on re-pairing, dust, gas | ~−0.05% |
| Performance fee (10% of profit) | −1.0% |
| **Net to depositors** | **~9.3%** |

### What makes the real number lower

- **Emissions change every week.** If voters move to other pools, the gauge rate drops, even to zero. Stable pools usually get fewer votes than big volatile pools.
- **AERO price.** Income is paid in AERO. Advertised APRs use today's AERO price; all farmers sell AERO, which pushes the price down over time. Selling at each harvest locks in USD value but doesn't escape this.
- **Our own deposits dilute the APR.** Adding $1M to a $10M gauge lowers everyone's APR ~9%. Small vault → small effect, but it matters at scale.
- **Depeg risk.** If the paired coin loses its peg, the pool fills with that coin; exiting to USDC takes a loss. This is the main risk for principal.
- **Idle time.** USDC waiting between deposit and deploy earns nothing.

Honest pitch: "variable yield in AERO emissions, sold to USDC, currently X% — can drop sharply week to week." Don't advertise a fixed APY.

## 5. Risks (short)

- **Dependencies:** Aero contracts (pool, gauge, router, Voter), USDC, the paired stablecoin, the price oracle. Any of them failing hurts the vault.
- **Price manipulation:** harvest swaps and `totalAssets` must use oracle-checked prices.
- **Gauge killed:** vault must still allow `gauge.withdraw` and plain LP → USDC exit. Add admin `migrate(newPool)`.
- **Keeper:** only keeper can call `harvest`, with a bounded `minUsdcOut`. If keeper stops, users can still withdraw; they just miss compounding.
- **ERC-4626 inflation attack** (first depositor manipulates share price): use OpenZeppelin's virtual shares offset or seed the vault at deploy.

## 6. Before deploy

- [ ] Run pool checklist (§2); record pool + gauge addresses.
- [ ] Verify all addresses in §2 on Basescan / via factory and Voter.
- [ ] Read live `rewardRate`, `totalSupply`, AERO price; replace example in §4.
- [ ] Fork test on Base: deposit → warp 1 week → harvest → withdraw; check USDC out > in.
- [ ] Fork test: sandwich the harvest swap; check `minOut` reverts.

## Open questions

1. Paired stablecoin: which one are we OK holding risk on?
2. Performance fee % and treasury address?
3. Keeper: own bot, Gelato, or Chainlink Automation?
4. Deposits right before harvest capture reward they didn't earn — accept, add deposit fee, or count pending AERO in `totalAssets`?
5. Slipstream (concentrated liquidity) as v2, or stay classic?
