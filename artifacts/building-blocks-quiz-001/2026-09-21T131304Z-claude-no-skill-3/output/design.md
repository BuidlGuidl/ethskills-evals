# USDC Yield Vault on Base — Design

Status: draft, pre-code. Every address/number marked **(verify)** must be checked on-chain before deploy.

## 1. Summary

- User deposits USDC, gets vault shares (ERC-4626).
- Vault turns USDC into LP tokens of one **Aerodrome** stable pool and **stakes them in that pool's gauge**.
- Keeper calls `harvest()`: claim AERO from the gauge → sell for USDC → re-LP → re-stake.

Key fact that shapes the whole design: on Aerodrome, **a staked LP earns AERO emissions only — not trading fees**. Fees from staked liquidity go to veAERO voters. So the vault's yield is "AERO emissions, sold for USDC", nothing else.

## 2. Which pool, and why

**Choice: Aerodrome classic stable pool (`sAMM`) USDC / USDT, staked in its gauge.** (verify gauge is alive and gets meaningful votes; if not, fall back to the highest-emission USDC/major-stable sAMM pool)

Why Aerodrome:
- It is the main DEX on Base by liquidity and the only one with large, ongoing incentives (AERO emissions directed by veAERO votes). Uniswap v3/v4 on Base pays fees only.

Why a stable/stable pool:
- Users deposit USDC and think in USDC. Pairing with another dollar stable keeps impermanent loss (loss from price moving between the two tokens) near zero, as long as neither stable depegs.
- A USDC/WETH pool would add ETH price exposure and real IL — a different product.

Why classic (`sAMM`) and not Slipstream (concentrated liquidity):
- Classic LP is a plain ERC-20 → trivial share accounting, one gauge deposit, no range management, no rebalancing keeper logic.
- Slipstream positions are NFTs with price ranges; out-of-range = zero emissions. More yield per dollar but much more code and risk. Out of scope for v1.

Trade-off accepted: stable pools usually get lower emission APR than volatile ones. We take lower, steadier yield in exchange for no ETH exposure.

## 3. Contracts involved (Base mainnet)

| Contract | Address | Notes |
|---|---|---|
| USDC (native) | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | (verify) |
| AERO | `0x940181a94A35A4569E4529A3CDfB74e38FD98631` | (verify) |
| Aerodrome Router | `0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43` | (verify) |
| Aerodrome PoolFactory | `0x420DD381b31aEf6683db6B902084cB0FFECe40Da` | (verify) |
| Aerodrome Voter | `0x16613524e02ad97eDfeF371bC883F2F5d6C480A5` | (verify) |
| Pool | `factory.getPool(USDC, USDT, true)` | resolve at deploy, store as immutable |
| Gauge | `voter.gauges(pool)` | resolve at deploy; also check `voter.isAlive(gauge)` |

## 4. Deposit / withdraw

Deposit:
1. Pull USDC from user.
2. Swap part of it to USDT via router so the pair matches pool reserves (use `router.quoteAddLiquidity` to size the split; `minOut` on the swap).
3. `router.addLiquidity(USDC, USDT, stable=true, ...)` → LP tokens.
4. `gauge.deposit(lpAmount)`.
5. Mint shares based on LP added (not USDC in), so depositors can't dilute others via swap slippage.

Withdraw: `gauge.withdraw(lp)` → `router.removeLiquidity` → swap USDT back to USDC → send to user.

v1 simplification option: skip per-deposit LP and batch idle USDC into LP on `harvest()`. Cheaper gas, simpler, slight yield drag. (open question)

## 5. harvest() — exact flow

`harvest()` is `onlyKeeper`, takes `minUsdcOut` (keeper computes off-chain from a quote).

1. **Claim AERO from the Gauge**: `gauge.getReward(address(this))`.
   - Source: the pool's **Gauge** contract (found via `voter.gauges(pool)`). Not the pool, not the Voter, not a rewards distributor.
   - Gauge only lets `account` itself (or the Voter) call this, so the vault must call it directly.
   - Output: AERO only.
2. **Do NOT call `pool.claimFees()`.** Our LP tokens sit in the gauge, so the vault is not the fee earner. The gauge collects those fees and forwards them to the voters' fee reward contract. Calling it would return ~0 and waste gas.
3. **Sell AERO → USDC** via `router.swapExactTokensForTokens`, route `AERO → USDC` volatile pool (or `AERO → WETH → USDC` if deeper; verify). Enforce `minUsdcOut`.
4. **Take performance fee** (e.g. 10% of USDC out) → treasury.
5. **Compound**: split remaining USDC into USDC/USDT (same as deposit step 2), `addLiquidity`, `gauge.deposit(lp)`.
6. Emit `Harvested(aeroClaimed, usdcOut, fee, lpAdded)`.

Notes:
- **Emissions stream, not drop.** Gauge rewards are paid out linearly over each weekly epoch (epochs flip Thursday 00:00 UTC). Harvesting often gives little extra; ~once a day is enough. Gas on Base is cheap, so frequency is set by swap size/slippage, not gas.
- **Price manipulation**: the AERO sell is the attack surface. Keeper-supplied `minUsdcOut` + a max-deviation check vs a TWAP or Chainlink AERO feed (if available, verify) as a second guard.
- **Share price** rises only when harvest compounds; pending AERO is not counted in `totalAssets()` (keeps accounting honest, avoids deposit-before-harvest sniping being based on unrealized value — still consider a small harvest-before-deposit or deposit fee, open question).
- `totalAssets()` = staked LP valued in USDC. Value LP from reserves carefully (reserve-based pricing is manipulable in one tx); for a stable/stable pool, pricing LP as `(reserve0 + reserve1) / totalSupply` with both tokens at $1 is acceptable only with a depeg circuit breaker. (open question: oracle choice)

## 6. What the position actually earns

### Sources of return

| Source | Does the vault get it? |
|---|---|
| Trading fees of the pool | **No.** Staked LP → fees go to veAERO voters. |
| AERO emissions from gauge | **Yes.** This is ~100% of gross yield. |
| Bribes / voting incentives | **No.** Those go to veAERO voters; we hold no veAERO. |
| USDC/USDT price moves | ~0, unless a depeg (then it's a loss, see risks). |

### Formula

```
gross emission APR = gauge.rewardRate() * 31_536_000 * AERO_price_usd
                     / (gauge.totalSupply() * LP_price_usd)
```

Note: this is what the Aerodrome UI shows as "APR". It is not what users get.

```
net APR ≈ gross emission APR
        × (1 - AERO sell slippage/price impact)
        × (1 - performance fee)
        - deposit/withdraw swap costs (USDC↔USDT, amortized)
        - keeper gas (small on Base)
        (+ small compounding effect)
```

### Illustrative example (made-up inputs, not a forecast)

Assume gauge shows 8% emission APR, vault TVL $500k:

| Item | Effect |
|---|---|
| Gross AERO emissions | 8.0% ≈ $40k/yr of AERO |
| AERO sale slippage + price drift between claims (~1%) | −0.08% |
| Performance fee 10% | −0.79% |
| Keeper gas (365 harvests × ~$0.05) | ~−0.004% |
| Trading fees | 0 |
| **Net to depositors** | **~7.1%** |

### Why the number moves (real-world caveats)

- **Emissions are re-voted every week.** A pool's AERO share can drop sharply from one epoch to the next if voters move elsewhere. Assume the rate is not stable.
- **AERO price.** Yield is paid in AERO; if AERO falls 30%, yield falls 30%. We sell on every harvest, so we don't hold AERO risk beyond one harvest interval.
- **Our own dilution.** Emission rate is fixed per gauge; adding our TVL lowers APR for everyone including us. Recompute APR with our TVL added before launch.
- **Depeg risk.** If USDT (or USDC) depegs, the stable curve lets the pool fill up with the weaker coin; LPs end up holding mostly it. This is the main tail risk.
- **Gauge killed.** Governance can kill a gauge → emissions stop. Vault must still allow withdraws; add an admin "exit to USDC" path.

## 7. Roles

- Keeper: `harvest(minUsdcOut)` only.
- Owner (multisig): set keeper, set fee (capped, e.g. ≤20%), pause deposits, emergency exit. No ability to move user funds elsewhere.

## Open questions

1. Confirm USDC/USDT sAMM gauge has meaningful emissions today; else which stable pair?
2. LP on every deposit vs batch on harvest?
3. Performance fee % and treasury address.
4. LP pricing / depeg guard: Chainlink USDT/USD feed on Base as breaker?
5. Protection against deposit-just-before-harvest (harvest-on-deposit, or small entry fee)?
6. Slipstream (CL) as a v2 for higher yield — in scope later or never?
