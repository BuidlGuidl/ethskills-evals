# Two-Tranche Yield Vault on Arbitrum — Design

Status: draft, no code yet. Chain: Arbitrum One (42161).
Live data below pulled **2026-09-21** from Pendle and GMX public APIs. Re-check before deploy — markets, rates, liquidity change.

## Summary

| | Tranche A (fixed) | Tranche B (trader fees) |
|---|---|---|
| Protocol | Pendle V2 — hold PT (Principal Token) | GMX V2 — hold GLV or GM liquidity token |
| Earns from | Buying PT below par; PT redeems 1:1 for underlying at expiry | 63% of GMX trading, borrow, liquidation, swap fees + trader losses |
| Rate | Fixed at purchase price | Variable; can be negative |
| Maturity | Pendle market expiry (not vault-chosen) | None |
| Keeper compounding | Nothing to compound | Nothing to claim (fees auto-accrue; no incentives live) |

Two findings change the brief:
1. **Fixed rate on Arbitrum today = USD.AI credit exposure.** Only USDai/sUSDai Pendle markets are active on Arbitrum.
2. **"Keeper compounds both" is mostly a no-op.** Neither position has rewards to claim and re-deposit. Keeper jobs are different (see Keeper section).

---

## Tranche A — Pendle PT

### Why Pendle
Pendle splits a yield-bearing token into PT (principal) and YT (yield). PT trades at a discount and redeems 1:1 for the underlying at expiry. Buying PT = locking a fixed rate until expiry. This matches "fixed rate, locked at deposit, paid at maturity."

### Live market check (Pendle API `core/v1/42161/markets/active`, 2026-09-21)

| Market | Address | Expiry | Liquidity | Implied APY |
|---|---|---|---|---|
| PT-USDai | `0xa8a0dea40174cfc30fea9e3a77f182ab33f46e25` | 2026-10-15 | $50.3M | 10.02% |
| PT-sUSDai | `0xcbf629c8d396b1261f81f55175afa010e94787d8` | 2026-10-15 | $11.5M | 12.13% |
| PT-sUSDai | `0xf86119a39f8654f38acbbd5488bd83f3f51983c8` | 2027-02-25 | $3.08M | 10.11% |
| PT-USDai | `0x46f545683d8494ef4c54b7ea40ca762c620846ef` | 2027-02-25 | $57k | 7.31% |

- These are the only 4 active Arbitrum markets. wstETH, rETH, gUSDC etc. expired (latest 2026-06-25) and were not renewed.
- Oct-15 markets are 24 days out — too short for a new product.
- **Candidate: PT-sUSDai 2027-02-25.** $3.1M liquidity caps realistic size; large buys move the price and lower the locked rate. PT-USDai Feb-2027 ($57k) is too thin.
- Addresses from Pendle API only — verify onchain (market → `readTokens()` → SY/PT/YT, `expiry()`) before use.

### How it earns
1. User deposits USDC (or USDai) into tranche A.
2. Vault swaps to PT via Pendle Router. Price paid sets the rate: e.g. pay 0.965 USDai-worth per PT, get 1.0 at expiry.
3. PT value drifts up toward par as expiry nears ("pull to par"). No claims, no rewards.
4. At expiry, vault redeems PT → SY → underlying, pays user.

Where the fixed rate comes from: YT buyers pay upfront for the variable yield + USD.AI points. Underlying sUSDai APY ~10.5%; USDai ~2.5% vs 10% implied — gap is mostly points speculation. If points demand fades, new PT rates fall (locked positions unaffected).

### Design consequences
- **Per-deposit rate lock needs per-deposit accounting.** Each deposit buys PT at a different price. Track PT amount per user/cohort, not a pooled share price. ERC-4626 shares don't fit well.
- **Maturity = Pendle expiry.** Vault can only offer dates Pendle markets exist for. Need cohort per market and a plan when no suitable market exists (close deposits).
- **Rate paid in underlying units, not USD.** PT-sUSDai pays sUSDai-worth of USDai. "Fixed rate" in USD holds only if USDai holds its peg.
- **Payout path at maturity.** sUSDai → USDai unstake goes through a FIFO redemption queue processed every 30 days; loans aren't liquidated to meet it. Payout in USDC can lag maturity. Alternative: sell on DEX (slippage). USDai itself claims instant redemption.
- **Rate quote at deposit:** use Pendle PT oracle (TWAP) + slippage bound; revert if rate below quoted minimum.

### Risks — Tranche A
- **Underlying credit:** USD.AI GPU-backed loans (RWA). Borrower default or GPU collateral value drop hits sUSDai → PT redeems for less. Fixed rate ≠ risk-free; ~10% signals risk.
- **Concentration:** one issuer, one market. No diversification available on Arbitrum Pendle today.
- **Peg:** USDai depeg → PT pays out fewer dollars.
- **Liquidity / slippage:** $3.1M pool. Entry size moves the rate; early exit before expiry sells at market, can realize a loss.
- **Redemption delay:** sUSDai queue (30-day cycles, FIFO) can delay payout.
- **Smart contract:** Pendle router/market/SY + USD.AI contracts.
- **Rollover gap:** no replacement market at expiry → funds sit idle or tranche closes.
- **Oracle:** PT spot price manipulable; NAV must use TWAP oracle.

---

## Tranche B — GMX V2 liquidity

### Why GMX V2
GMX is the main perps venue on Arbitrum. LPs in GM (single market) or GLV (basket of GM markets) are the counterparty to leveraged traders and receive their fees — matches "earns fees leveraged traders pay."

### Live market check (GMX API `arbitrum-api.gmxinfra.io`, 2026-09-21)

| Pool | Token | Value / OI | 30d APY | Bonus APR |
|---|---|---|---|---|
| GLV [ETH-USDC] | `0x528A5bac7E746C9A509A1f4F6dF58A03d44279F9` | $16.2M, 54 markets | 9.16% | 0 |
| GLV [WBTC.b-USDC] | `0xdF03EEd325b82bC1d4Db8b49c30ecc9E05104b96` | $13.8M, 40 markets | — | — |
| GM ETH/USD [ETH-USDC] | `0x70d95587d40A2caf56bd97485aB3Eec10Bee6336` | OI $11.5M | 5.53% | 0 |
| GM BTC/USD [WBTC.b-USDC] | `0x47c031236e19d024b42f8AE6780E44A573170703` | OI $12.9M | 3.91% | 0 |

- Trading activity is modest: largest market OI ~$13M. Fee yield scales with it.
- No incentive programme live (`bonusApr` 0).
- **Candidate: GLV [ETH-USDC].** Higher 30d yield, spreads across 54 markets, GMX rebalances between them. GM ETH/USD is the simpler fallback.

### How it earns
- Per GMX docs: LPs get **63%** of fees from open/close, borrowing, liquidations, swaps (Arbitrum). Rest to protocol.
- Fees flow into the pool → GM/GLV token price rises. **No claim step.** Holding = compounding.
- Also: trader losses add to pool value; trader profits come out of it.
- Pool holds ~ETH + USDC → token price also moves with ETH.

So B's return = fees + (−trader net PnL) + ETH price exposure (+ price impact rebates). Not "fees only."

### Design consequences
- **Async deposits/withdrawals.** GMX V2 uses two-step orders: vault creates a deposit/withdrawal request + pays ETH execution fee; GMX keeper executes later (or cancels). Vault needs pending state, callback handling, refund handling. User deposits into B cannot mint shares instantly at a known price.
- **Withdrawals can be capped** by reserved liquidity backing open positions — mass exit may be partial/delayed.
- **NAV:** price GM/GLV via GMX Reader + oracle prices, not a spot DEX price.

### Risks — Tranche B
- **Trader PnL:** pool is the counterparty. Traders winning big = LP loss, can exceed fee income.
- **Market exposure:** ~50% ETH (or BTC). ETH drop = token value drop, independent of fees.
- **Low volume:** small OI → small fees; APY is backward-looking 30d, not a promise.
- **Liquidity lock:** reserved tokens limit withdrawals; ADL (auto-deleverage) and max PnL caps protect pool but signal stress.
- **Execution:** async flow, execution fee, cancellations, callback gas limits.
- **Oracle:** GMX uses its own oracle keepers (Chainlink Data Streams); bad prices = bad fills against pool.
- **Smart contract:** GMX V1 GLP was exploited for ~$42M on 2025-07-09 (reentrancy). V2 unaffected per GMX; funds recovered. Still same team/codebase lineage — size accordingly.
- **Stablecoin:** USDC depeg affects short side.
- **Arbitrum:** sequencer downtime blocks both trading and exits.

---

## Keeper

"Compounds both" doesn't map to real work:
- A: PT has nothing to claim. Keeper job = at expiry, redeem PT and pay/roll cohort.
- B: fees auto-accrue into token price; no rewards to claim today. Keeper job = handle async GMX deposit/withdraw lifecycle (or rely on GMX keepers + callbacks) and top up execution-fee ETH.
- If incentives return (ARB, GMX rewards), add a harvest step then — trace claim → swap → re-deposit and its slippage.

## Cross-tranche

- **These aren't tranches in the usual sense.** Usually B absorbs A's losses first. Here A and B are separate strategies; B does not protect A, A does not cap B. If subordination is intended, the design is different (B capital backstops A payout).
- Keep assets fully separate: separate contracts or strict per-tranche accounting. A USD.AI loss must not touch B, GMX loss must not touch A.

## Verification before code
- Read onchain on a fork: Pendle market `expiry()`, `readTokens()`, PT oracle readiness (`getOracleState`); GMX GLV/GM token via Reader, deposit/withdraw handlers.
- Fork tests: full flow per tranche incl. deposit → hold → exit; GMX cancelled deposit; withdrawal above available liquidity; PT exit before expiry; PT redeem after expiry; sUSDai queue delay.
- Sanity check sizes against live liquidity ($3.1M Pendle pool, ~$16M GLV).

## Open questions
1. Is B meant to backstop A (real tranching) or just two side-by-side strategies?
2. Is USD.AI credit exposure acceptable for A? If not, no Pendle fixed rate exists on Arbitrum today — go to another chain or other fixed-rate venue.
3. User payout asset for A: USDC or USDai? (affects queue/slippage handling)
4. Maturity: accept Pendle's 2027-02-25 only, or wait for new markets?
5. B pool: GLV [ETH-USDC] vs GM ETH/USD vs BTC variant?
6. Max vault size per tranche given pool liquidity?

## Sources (fetched 2026-09-21)
- Pendle markets: `https://api-v2.pendle.finance/core/v1/42161/markets/active`, `.../markets/inactive`
- GMX: `https://arbitrum-api.gmxinfra.io/markets/info`, `/glvs/info`, `/apy?period=30d`
- GMX LP docs: https://docs.gmx.io/docs/providing-liquidity
- USD.AI docs: https://docs.usd.ai/faq/usdai-and-susdai-101, https://docs.usd.ai/depositor/susdai
- GMX V1 exploit: https://x.com/GMX_IO/status/1942955807756165574, https://gmxio.substack.com/p/glp-funds-on-arbitrum-fully-recovered
