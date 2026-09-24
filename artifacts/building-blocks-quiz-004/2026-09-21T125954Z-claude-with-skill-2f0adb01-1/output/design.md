# Two-Tranche Yield Vault — Design (Arbitrum)

## Overview

| | Tranche A — Fixed | Tranche B — Trader Fees |
|---|---|---|
| Protocol | **Pendle** (buy PT) | **GMX V2** (GM pools, or GLV vault) |
| Position | PT token of one Pendle market | GM tokens (e.g. ETH/USD GM, backed by WETH + USDC) |
| How it earns | PT bought at discount, redeems 1:1 for underlying at maturity | Pool collects fees from leveraged traders; GM token price rises |
| Return shape | Fixed, known at deposit (if held to maturity) | Variable; can be negative |
| Exit | At maturity: redeem at par. Before: sell PT at market price | Async withdraw request via GMX; may be limited by pool reserves |

Contract addresses (Pendle Router, market/PT per maturity, GMX ExchangeRouter, DepositVault, Reader, GM market tokens) are **not** hardcoded here — verify each against official Pendle/GMX docs at build time.

---

## Tranche A — Fixed rate via Pendle PT

### Where it deploys
Pendle splits a yield-bearing asset (SY) into:
- **PT** (Principal Token) — redeemable 1:1 for the underlying at maturity
- **YT** (Yield Token) — all yield until maturity; worth 0 at maturity

Invariant: `SY value = PT value + YT value`.

Tranche A only holds **PT**. Candidate underlyings on Arbitrum: a stablecoin yield asset (e.g. PT on a USDC-based SY) if we want a USD fixed rate, or PT-wstETH/PT-weETH if we want an ETH-denominated fixed rate. **Pick one underlying + one maturity per series** — the fixed rate is only fixed in the underlying's unit.

### How it earns
- Vault swaps deposit → PT through the Pendle Router/AMM.
- PT trades at a discount to par. The discount *is* the fixed rate: e.g. pay 0.95 for PT that redeems for 1.00 in 1 year ≈ 5.3% fixed.
- The PT price drifts toward 1.00 as maturity nears. At maturity the vault redeems PT → underlying.
- **No cashflows before maturity.** PT pays no coupon and earns no PENDLE incentives (those go to LPs / YT holders).

### Consequences for vault design
1. **"Locked at deposit" means per-deposit rate.** Each deposit buys PT at that moment's price, so two depositors a week apart get different rates. Options:
   - Record per-deposit `ptAmount` (user's claim at maturity = their PT, redeemed). Simplest and honest. Recommended.
   - Pooled ERC-4626 share where share price = PT mark-to-market. Works, but "promised rate" becomes blended — don't market it as per-user fixed.
2. **One series per maturity.** Pendle markets expire; tranche A is a set of series (e.g. `A-Dec2026`, `A-Jun2027`), each tied to one Pendle market. After maturity, users claim or opt into roll to next series.
3. **Slippage on entry is part of the rate.** Quote the rate *after* price impact; enforce `minPtOut` from user input, not from an onchain spot read.
4. **"Keeper compounds" doesn't apply here.** PT has nothing to harvest. Keeper jobs for A: redeem at maturity, optionally roll into the next market, and sweep any stray dust/rewards. Idle cash between deposit batching and PT purchase should not sit un-invested for long (it dilutes the promised rate).

### Risks — Tranche A
- **Early exit = market risk.** Before maturity PT is sold at market price. If implied rates rose since entry, the user gets less than accrued value, possibly less than deposit. Fixed rate is only guaranteed if held to maturity.
- **Underlying asset risk.** PT redeems for 1 unit of the *underlying SY asset*, not 1 USDC/ETH. If the underlying depegs, is hacked, or has losses (e.g. yield-bearing stablecoin loss event, LST slashing), PT redeems into a devalued asset. This is the biggest real risk — "fixed" is fixed in underlying units.
- **Pendle smart-contract risk** (router, market, SY wrapper) plus the underlying protocol's contract risk.
- **Liquidity risk.** Pendle AMM liquidity thins near maturity; large entries/exits move price. Cap deposit size vs market depth.
- **Oracle / pricing risk.** If we mark PT for share accounting, use Pendle's TWAP-based PT oracle, never spot AMM price (flash-loan manipulable).
- **Rollover risk.** Next maturity's rate may be much lower; rolling is not guaranteed to keep the same rate.

---

## Tranche B — Trader fees via GMX V2

### Where it deploys
GMX V2 on Arbitrum. LPs deposit into **GM pools**, one isolated pool per market:
- **Fully backed markets** (e.g. ETH/USD backed by WETH + USDC) — backing matches the traded asset. Recommended.
- **Synthetic markets** (e.g. DOGE/USD backed by ETH + USDC) — backing ≠ traded asset, uses auto-deleveraging. Avoid initially.

Alternative: **GLV** (GMX Liquidity Vault), which spreads liquidity across several GM markets sharing a backing pair and rebalances by utilization. Less manual work for our keeper; one more layer of contract risk.

Recommendation: start with 1–2 fully backed GM markets (ETH/USD, BTC/USD) or the matching GLV.

### How it earns
GM token price = pool value / GM supply. Pool value grows from:
- **Open/close position fees** from leveraged traders
- **Borrowing fees** — traders pay hourly for reserved pool liquidity (main "leverage fee")
- **Liquidation fees**
- **Swap fees** on the pool's swap route
- Plus a share of **funding imbalance**, but funding mostly flows trader-to-trader

Fees accrue **directly into pool value** — there's no reward to claim and restake for GM itself. So yield shows up as a rising GM price, not a token stream.

**But the pool is the counterparty to traders.** When traders win, pool value falls; when they lose, it rises. Net LP return = fees − trader net PnL ± backing token price moves.

### Consequences for vault design
1. **Deposits/withdrawals are async.** GMX V2 uses a two-step flow: vault creates a deposit/withdrawal request (paying an ETH execution fee), GMX keepers execute it later with oracle prices. Vault needs pending-request state, callbacks or polling, and cannot mint/burn tranche B shares at a price known in the same tx.
   - Queue user deposits/withdrawals; settle shares after GMX execution.
   - Vault must hold ETH for execution fees (or charge users for them).
2. **Share pricing.** Value GM via GMX's Reader/oracle prices (GMX's own `getMarketTokenPrice` with oracle prices), never a DEX spot price. Consider max/min price side for deposits vs withdrawals to avoid value leakage.
3. **"Keeper compounds" here means:** fees already compound in GM price. Keeper jobs for B: process queued deposits/withdrawals, top up execution-fee ETH, claim and sell any external incentives (e.g. ARB/GMX incentive programs if active) back into GM, and rebalance between markets if we hold more than one.
4. **Single-sided deposits** incur price impact/fees if they unbalance the pool; prefer depositing in the pool's current ratio or accept and quote the impact.

### Risks — Tranche B
- **Trader PnL risk.** Directly exposed to traders' profits. A strong trend where traders are net long and right = LP losses. Fees don't always cover it.
- **Backing asset price risk.** ETH/USD GM holds ~WETH + USDC; GM value moves with ETH price (roughly half-exposure). This is not a USD-stable product.
- **Withdrawal liquidity risk.** Liquidity reserved for open positions can't be withdrawn; at high utilization, withdrawals may be partially blocked or delayed. Tranche B redemptions must be queued, not instant.
- **Async execution risk.** Requests may be cancelled (price moved, slippage, insufficient execution fee); vault must handle refunds cleanly. Stuck requests = stuck user funds.
- **Oracle risk.** GMX relies on its Chainlink Data Streams-based oracle setup; oracle failures or keeper outages pause the market.
- **ADL / synthetic-market risk** if we ever use synthetic markets.
- **GMX smart-contract & governance risk** (parameter changes to fees, caps, reserve factors). GMX V2 has had exploits/incidents before — size positions accordingly.
- **Sequencer risk (Arbitrum).** Sequencer downtime blocks execution; handle stale-price guards.

---

## Shared / vault-level

- **Tranches are separate books.** A and B do not subsidize each other (no senior/junior waterfall). If we later want B to backstop A's promised rate, that's a different, much riskier design — flag before building.
- **Keeper trust.** Keeper should only be able to call bounded actions (redeem at maturity, roll, process queue, sell rewards with slippage caps to allowlisted routes). No arbitrary calls; no custody of user funds.
- **Composability risk stacks.** A depends on Pendle + the underlying yield protocol. B depends on GMX + Chainlink oracles + GMX keepers. Any one failing hits the tranche.
- **Start small:** deposit caps per tranche, raised as monitoring proves out.
- **Standards:** ERC-4626-like interface where possible; tranche B needs async extension (ERC-7540 style request/claim) given GMX's two-step flow.

## Open questions
1. Tranche A underlying: USD (stable-yield PT) or ETH (PT-wstETH/weETH)?
2. Tranche A accounting: per-deposit PT claims (recommended) or pooled blended rate?
3. Tranche B: single GM market(s) or GLV?
4. Tranche B denomination: accept ETH exposure, or hedge it (adds complexity)?
5. Who pays GMX execution fees — users or vault?
6. Early exit for A: allow (sell PT at market) or lock until maturity?
