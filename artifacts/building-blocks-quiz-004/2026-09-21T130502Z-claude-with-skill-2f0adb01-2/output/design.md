# Two-Tranche Yield Vault — Design (Arbitrum)

Status: draft, pre-code.

## Overview

| | Tranche A — Fixed | Tranche B — Trader fees |
|---|---|---|
| Deploys into | **Pendle** PT (Principal Token) | **GMX V2** GM pools (or GLV) |
| Earns from | Buying PT below par; PT → 1:1 at maturity | Fees paid by leveraged traders + trader losses |
| Return shape | Fixed, known at deposit, paid at maturity | Variable, can be negative |
| Keeper job | Roll at maturity, harvest any incentives | Harvest incentives, rebalance, re-deposit |

The two tranches are **independent strategies**, not senior/junior. Tranche B does not
backstop tranche A. The fixed rate comes from Pendle's market, not from B. (See open questions.)

---

## Tranche A — Fixed rate via Pendle PT

### Where it goes
Pendle on Arbitrum. Pendle splits a yield-bearing asset (wrapped as **SY**, "standardized
yield") into:
- **PT** — principal, redeemable 1:1 for the underlying at maturity
- **YT** — all yield until maturity; worth 0 at maturity

`SY value = PT value + YT value`.

Vault buys PT of one chosen market (e.g. a stablecoin or wstETH market) and holds to maturity.

### How it earns
- PT trades at a discount to par. Discount = implied fixed yield.
  Example: PT at 0.95 with 1 year left → ~5.3% fixed, paid by redeeming at 1.00.
- No streaming yield — PT value just climbs toward 1.00 as maturity nears.
- **Rate lock per depositor:** each deposit swaps into PT at that moment's price. Mint shares
  in **PT units**, not asset value. At maturity 1 share = 1 underlying, so each depositor's
  rate is whatever PT price their own deposit got. Late depositors don't dilute early ones.
- One vault (ERC-4626) per Pendle maturity ("series"). Simple, clean accounting.

### What "compound" means here
Almost nothing before maturity — PT pays no yield to reinvest. Keeper's jobs:
- Claim PENDLE / other incentives if any, swap to underlying, buy more PT (credited pro rata).
- At maturity: redeem PT → underlying. Either pay out, or roll into next maturity **only if
  user opted in** (new rate ≠ old rate, so rolling isn't the "promised" rate anymore).

### Risks
- **Underlying asset risk.** Fixed rate is in units of the underlying, not USD. If the
  underlying depegs, gets hacked, or its exchange rate drops (e.g. slashing, stablecoin
  depeg), PT redeems for less real value. The "fixed" rate is only as good as the underlying.
- **Early exit = market price.** Before maturity, exit means selling PT on Pendle's AMM.
  If rates rose, PT is cheaper → user loses vs. entry. Must be stated clearly in UI.
- **Entry slippage.** Large deposits move PT price → worse rate. Enforce min-PT-out /
  max rate slippage per deposit.
- **Pricing / oracle.** Share value before maturity needs PT price. Use Pendle's TWAP PT
  oracle, never spot AMM price (flash-loan manipulation risk).
- **Liquidity near maturity.** Pendle AMM liquidity thins as maturity nears; early exits get worse.
- **Pendle contract risk** + SY wrapper risk for the chosen market.
- **Maturity ops.** If keeper fails to redeem/roll, funds sit idle (safe, but no yield).

---

## Tranche B — Trader fees via GMX V2

### Where it goes
GMX V2 on Arbitrum. Each market has an isolated GM pool. Recommend a **fully backed**
market (e.g. ETH/USD backed by ETH + USDC) over synthetic ones. Alternative: **GLV**
(GMX Liquidity Vault) which spreads across several GM pools with same backing tokens.

### How it earns
GM LPs are the counterparty ("the house") to leveraged traders. Pool earns:
- Open/close position fees
- Borrowing fees (traders pay for holding leverage)
- Liquidation fees
- Swap fees
- **Trader net losses** (and pays out trader net profits)

A share of fees goes to LPs (rest to GMX stakers/treasury — check current split). Fees accrue
into the pool, so **GM token price rises by itself**; no claim step for core fees.

### What "compound" means here
- Core fees already compound inside GM price.
- Keeper claims extra incentives (e.g. ARB/GMX rewards if running), swaps into backing
  tokens, deposits into GM.
- Optional: rebalance between GM pools / GLV.

### GMX integration details that shape the vault
- **Deposits and withdrawals are async (two-step).** Vault creates a request; a GMX keeper
  executes it later with an oracle price. Vault must:
  - pay an execution fee in ETH per request
  - track pending requests, handle success/cancel callbacks
  - not treat pending amounts as settled in share price
- Users' deposits/withdrawals therefore can't be instant; use request/claim flow
  (queue-based, not plain synchronous ERC-4626, or ERC-7540 async vault).
- Withdrawals can be limited when pool liquidity is reserved for open interest.
- Deposits that unbalance the pool pay price-impact fees; withdrawals may too.

### Risks
- **Trader PnL.** If traders win big, GM price falls. Fees don't guarantee positive return.
- **Price exposure of backing.** ETH/USD pool holds ETH + USDC → roughly half exposed to ETH
  price. Not delta-neutral unless we hedge (out of scope for v1).
- **ADL / reserve limits.** Auto-deleveraging and reserve caps protect the pool but can lock
  withdrawals during stress — exactly when users want out.
- **Oracle risk.** GMX relies on its oracle set (Chainlink Data Streams). Bad prices = LP loss.
- **GMX contract risk.** GMX has been exploited before (V1 GLP, July 2025). V2 is separate
  code but same team/ecosystem.
- **Async execution risk.** Stuck/cancelled requests, execution fee changes, callback bugs
  in our own vault.
- **Incentive dependence.** Headline APY often includes temporary incentives; organic fees
  may be much lower.

---

## Shared risks

- **Keeper.** Key compromise, downtime, or bad params. Keeper should only call whitelisted
  actions with on-chain min-out checks; can't move funds elsewhere.
- **MEV on keeper swaps.** Incentive-token swaps can be sandwiched. Use slippage limits,
  private RPC / small batches.
- **Arbitrum sequencer downtime.** No keeper actions, no user exits; oracle staleness checks
  needed (Chainlink sequencer uptime feed).
- **Composition risk.** Each protocol is a dependency; their interaction with our vault
  (share-price math, pending requests, rounding) is where most bugs live. Audit the vault
  and the integration, not just rely on Pendle/GMX audits.
- **Share inflation attack** on first deposit (ERC-4626). Use virtual shares / seed deposit.
- **Admin/upgrade risk.** Timelock + multisig for param changes, market selection.

## Addresses
Take all contract addresses (Pendle router/markets/oracle, GMX ExchangeRouter/Reader/markets)
from official docs at build time and verify on Arbiscan. Don't hardcode from memory.

## Open questions
1. Tranches independent (as above), or real senior/junior where B absorbs A's shortfall?
   Latter needs a very different design.
2. Tranche A underlying: stablecoin (USD-fixed) or ETH-based (ETH-fixed)?
3. Tranche A at maturity: auto-pay out, or opt-in roll?
4. Tranche B: single GM market or GLV? Hedge ETH exposure or accept it?
5. Deposit asset: one asset (e.g. USDC) routed to both, or tranche-specific?
6. Acceptable async UX for tranche B (minutes-level deposit/withdraw delay)?
