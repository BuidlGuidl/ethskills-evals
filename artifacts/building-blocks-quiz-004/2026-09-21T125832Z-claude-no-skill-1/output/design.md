# Two-Tranche Yield Vault — Design (Arbitrum)

Status: draft, pre-code. Addresses, market lists, and fee splits below must be re-checked against live contracts/docs before implementation.

## Summary

| | Tranche A — Fixed | Tranche B — Trader fees |
|---|---|---|
| Protocol | **Pendle V2** (buy PT) | **GMX V2** (GM pool or GLV vault) |
| Position held | PT token for one market + maturity | GM / GLV token |
| Earns from | Buying PT below face value; redeems 1:1 at maturity | Fees leveraged traders pay (open/close, borrow), swap fees, price impact, trader losses |
| Rate | Fixed at deposit (set by PT price paid) | Variable, can be negative |
| Keeper job | Redeem at maturity, roll or pay out | Claim incentives (if any) and re-deposit; handle async GMX requests |
| Share model | Per-deposit position (not fungible) | ERC-4626 fungible shares |

Note: the two tranches are **independent strategies**, not a senior/junior structure. B does not absorb A's losses and A does not cap B's upside. If "tranche" is meant in the subordination sense, that's a different design (see Open questions).

---

## Tranche A — Fixed rate via Pendle PT

### Protocol
Pendle V2 on Arbitrum. Pendle splits a yield-bearing asset (e.g. sUSDe, wstETH, aUSDC — wrapped as "SY") into:
- **PT** (principal token): redeemable for 1 unit of the underlying's accounting asset at maturity.
- **YT** (yield token): gets all the variable yield until maturity.

We hold PT only.

### How it earns
1. User deposits asset (e.g. USDC).
2. Vault swaps into PT via Pendle Router (e.g. pay 0.95 → get 1.00 PT face value).
3. The discount *is* the yield. Implied fixed APY = `(1 / ptPrice)^(365 / daysToMaturity) - 1`.
4. At maturity, PT redeems 1:1 for the accounting asset → user gets face value.

Rate is locked at deposit because the user's claim is denominated in **PT units bought**, not in vault shares. Each deposit records `{owner, market, ptAmount, maturity, depositAmount}`. Payout at maturity = `ptAmount` redeemed. Different depositors get different rates depending on PT price when they entered — this is correct and expected.

### What "compounding" means here
Nothing to compound before maturity: PT pays no stream, no emissions. Keeper role for A is:
- At/after maturity: redeem PT → underlying, then either pay out or roll into the next maturity's PT (only if user opted in; the new rate is a new lock).
- Do **not** hold Pendle LP to "earn more" — LP value is not fixed and breaks the promise.

### Market selection
- Prefer stablecoin-accounted markets for a USD fixed rate (e.g. PT on aUSDC / sUSDe-type SY). Check which markets exist on Arbitrum and their liquidity at build time.
- Rate is fixed **in the SY's accounting asset**. PT-wstETH is fixed in ETH, not USD. PT-sUSDe is fixed in USDe, not USDC.
- Require min liquidity and min days-to-maturity; reject deposits that would move price more than X bps.

### Risks
- **Underlying/depeg risk**: PT redeems for the accounting asset. If that asset (USDe, a LST, an Aave aToken) depegs or its protocol is hacked, the "fixed" rate is fixed in a broken unit. Biggest real risk.
- **Early-exit risk**: leaving before maturity means selling PT on Pendle AMM at market price. If rates rose, PT price fell → user can get back less than deposited. Must be clearly shown in UI; or disallow early exit.
- **Entry slippage / price impact**: large deposits get a worse rate. Quote rate before execution, enforce `minPtOut`.
- **Liquidity near maturity**: Pendle AMM gets thin/concentrated near expiry; late deposits get bad fills. Set cutoff (e.g. no deposits in last N days).
- **Oracle for valuation**: for any mark-to-market (early exit quotes, TVL display) use Pendle's TWAP PT oracle, never spot AMM price.
- **Smart contract risk**: Pendle router/market/SY + underlying protocol + our vault.
- **Rollover risk**: next maturity's rate may be lower; must not be presented as the same fixed rate.
- **Arbitrum sequencer downtime**: users can't act; maturity payout delayed (not lost).

---

## Tranche B — Trader fees via GMX V2 liquidity

### Protocol
GMX V2 on Arbitrum. LPs deposit into **GM pools** (one per market, e.g. ETH/USD backed by WETH + USDC) or **GLV vaults** (a GMX-managed basket of GM pools sharing the same backing tokens, auto-rebalanced toward the highest-utilization markets).

Recommendation: start with **GLV [WETH-USDC]** (diversified across markets, less ops for us) or a single **GM ETH/USD [WETH-USDC]** if we want simpler accounting. Decide before build (Open questions).

### How it earns
LPs are the counterparty to every leveraged trader. Pool value grows from:
- **Open/close position fees** paid by traders.
- **Borrow fees** traders pay per hour for open positions.
- **Swap fees** on swaps routed through the pool.
- **Price impact** collected on imbalancing trades.
- **Trader losses**: when traders lose, the pool gains (and vice versa).
- Liquidation fees.

A share of fees goes to LPs (majority; rest to GMX stakers, treasury, oracle — verify current split). Fees accrue into the **GM/GLV token price** — the token auto-compounds; there's no separate claim for base fees.

Funding fees mostly move between longs and shorts, not to LPs.

### What "compounding" means here
Base fees already compound inside GM/GLV price. Keeper role for B:
- Claim any incentive rewards (e.g. ARB programs, if active), swap to backing tokens, re-deposit.
- Deploy idle deposits into GM/GLV in batches.
- Process withdrawals.

GMX deposits/withdrawals are **asynchronous**: vault creates a request + pays an ETH execution fee, GMX keepers execute it in a later block using oracle prices. Vault needs pending-state accounting (don't mint/burn shares until the callback / execution confirms), and must refund/handle cancelled requests.

### Risks
- **Trader PnL risk**: if traders are net profitable (e.g. strong one-way trend with crowded correct side), pool loses value. This is the core risk B is paid for.
- **Market exposure**: GM [WETH-USDC] holds ~half WETH → vault value moves with ETH price. Not a stable-denominated product. (Single-sided/stable-only pools reduce this but change fee profile.)
- **Pool imbalance / ADL**: at high open-interest vs pool size, GMX may auto-deleverage profitable traders; reserve caps can limit withdrawals.
- **Withdrawal liquidity**: LP funds backing open positions may not be withdrawable immediately; users can be stuck until OI drops.
- **Async execution risk**: requests can be cancelled or executed at a different price than quoted; execution fees paid in ETH must be funded (by user or vault).
- **Oracle risk**: GMX relies on Chainlink Data Streams + its keepers. Oracle failure or manipulation hits LPs directly.
- **Fee rate is variable**: low trading volume → low yield; yield can be negative after trader PnL and ETH moves.
- **Share-price manipulation in our vault**: value GM/GLV via GMX's own pricing (Reader contract, using oracle prices), not a DEX spot price; protect against first-depositor inflation attack (ERC-4626 virtual shares/offset).
- **Smart contract / governance risk**: GMX contracts, parameter changes (fee rates, caps) by GMX governance.
- **Arbitrum sequencer downtime**: GMX halts; positions/prices frozen, withdrawals delayed.

---

## Shared / vault-level risks
- **Keeper failure**: A payouts at maturity and B deposits stall if keeper is down. Make maturity redemption **permissionless** (anyone can call) so users are never stuck on our keeper.
- **Admin keys**: timelock + multisig for market allowlists, parameter changes, and pausing. No admin path to move user funds.
- **Pause scope**: pausing deposits must never block A maturity redemptions or B withdrawals where the underlying protocol allows them.
- **Integrations upgrade**: Pendle/GMX router addresses change over time; keep them configurable behind timelock.

## Open questions
1. Is "tranche" meant as senior/junior (B backstops A's fixed rate)? Current design: no, independent strategies.
2. A: which denomination — USD (stable PT market) or ETH? Which underlying do we trust for depeg risk?
3. A: allow early exit at market price, or lock until maturity?
4. A: auto-roll at maturity by default, or pay out?
5. B: GLV basket vs single GM pool?
6. B: who pays GMX execution fees — user at deposit, or vault from yield?
7. Deposit asset: USDC only, or also ETH?
