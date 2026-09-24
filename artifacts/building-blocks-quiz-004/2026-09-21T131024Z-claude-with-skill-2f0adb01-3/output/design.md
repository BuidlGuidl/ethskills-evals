# Two-Tranche Yield Vault — Design (Arbitrum)

Status: draft, pre-code. Contract addresses deliberately left out; verify from official docs/deployments before use.

## Overview

| | Tranche A — Fixed | Tranche B — Trader fees |
|---|---|---|
| Protocol | **Pendle V2** (PT tokens) | **GMX V2** (GM pools, or GLV) |
| Position | Principal Token (PT) of one Pendle market | GM tokens of one or more GM markets |
| Earns via | Buying PT at a discount, redeeming 1:1 at maturity | Fees paid by leveraged traders + swappers, accrued into GM price |
| Rate | Fixed, set by PT price at purchase | Variable, can be negative |
| Keeper role | Buy PT for new deposits, redeem/roll at maturity | Harvest + reinvest incentive rewards, rebalance |

Each tranche is its own ERC-4626-style vault (or share class). They are **independent strategies**, not a senior/junior structure — B does not cover A's losses (see open questions).

---

## Tranche A — Fixed rate via Pendle PT

### Where it deploys
A Pendle market on Arbitrum whose maturity matches the tranche's maturity date. Pendle splits a yield-bearing asset (e.g. wstETH, a yield-bearing stable) into:
- **SY** — wrapped yield-bearing asset
- **PT** — principal, redeemable 1:1 for the underlying (accounting asset) at maturity
- **YT** — all yield until maturity, worth 0 at maturity

Invariant: `SY value = PT value + YT value`.

### How it earns
1. User deposits asset X.
2. Vault swaps X → PT on the Pendle AMM (via Pendle router). PT trades below 1 (e.g. 0.95).
3. At maturity, 1 PT redeems for 1 unit of underlying. Discount → gain. That's the fixed rate (implied APY at purchase time).
4. Vault pays user at maturity.

Nothing to "compound" during the term: PT pays no cash flow, it just converges to 1. The rate is locked by the purchase price.

### Design consequences
- **Rate is per-deposit, not per-vault.** Each deposit buys PT at the current market price, so users entering on different days get different rates. Need per-deposit accounting: store `ptAmount` (or PT-denominated shares) per depositor. Quote the rate before deposit and enforce with slippage/min-PT-out.
- **Fixed in underlying units, not USD.** A PT-wstETH market gives a fixed rate in ETH terms. For a USD fixed rate, use a stablecoin-underlying market.
- **Early exit is not at the fixed rate.** Before maturity, withdrawing means selling PT at market price → could be below cost if implied rates rose. Options: disallow early exit, or allow at market price with clear UI.
- **After maturity:** keeper redeems PT → underlying. Then either pay out or roll into the next maturity (new rate, needs user opt-in).
- **Share price for 4626:** mark PT using Pendle's TWAP oracle (PT/asset rate), never AMM spot.

### Risks — Tranche A
| Risk | Notes |
|---|---|
| Underlying asset risk | PT redeems into the underlying. If it depegs, gets slashed, or its issuer fails, "fixed" payout is worth less. Biggest real risk. Choose underlying carefully. |
| Rate / mark-to-market risk | PT price moves with implied yield before maturity. Only matters for early exit / NAV display, not for hold-to-maturity. |
| Liquidity / slippage | Pendle AMM liquidity per market is finite; large deposits move the rate. Liquidity thins near maturity. Cap deposit size per block/tx. |
| Smart contract risk | Pendle core + SY wrapper + underlying protocol (e.g. Lido, stable issuer). Stacked dependencies. |
| Oracle manipulation | Using spot PT price for share pricing lets attackers (flash loans) skew deposits/withdrawals. Use TWAP. |
| Maturity mismatch | One vault = one maturity. Multiple maturities → multiple vaults/series. |
| Keeper failure | If keeper doesn't redeem at maturity, funds sit idle as matured PT (still redeemable, no loss, just no yield). Make redemption permissionless. |

---

## Tranche B — Trader fees via GMX V2

### Where it deploys
GMX V2 GM pools on Arbitrum (e.g. ETH/USD backed by ETH + USDC). Alternative: **GLV** (GMX Liquidity Vault), which spreads liquidity across several GM markets with the same backing tokens and rebalances automatically — simpler for us, less market selection logic.

### How it earns
LPs are the counterparty to GMX traders. The pool collects:
- open/close position fees
- borrowing fees (paid by leveraged positions for using pool liquidity)
- swap fees
- liquidation fees
- trader losses (and pays out trader profits)

Most fees go to LPs; they accrue into pool value, so **GM token price rises by itself** — fee compounding is built in. Funding fees mostly flow between longs and shorts, not to LPs.

Keeper "compounding" for B therefore means:
- claim any incentive rewards (e.g. ARB/GMX incentive programs when active), swap to backing tokens, deposit into GM
- optionally rebalance between markets / backing tokens

### Design consequences
- **Deposits/withdrawals are async.** GMX V2 uses a two-step flow: vault creates a deposit/withdrawal request + pays an execution fee (ETH), GMX keepers execute it in a later tx using oracle prices. Vault needs pending-state handling and callbacks; users can't get shares in the same tx.
- **Withdrawals can be limited.** Liquidity reserved for open interest can't be withdrawn. Vault must handle partial/delayed exits (queue).
- **Price exposure.** A fully backed ETH/USD pool holds ETH + USDC → tranche B has ~partial ETH price exposure, not a stable yield. Decide if that's acceptable or pick a stable-heavy composition.
- **Share price for 4626:** use GMX's own pool value calc (Reader contract with oracle prices), not a DEX price.

### Risks — Tranche B
| Risk | Notes |
|---|---|
| Trader PnL (counterparty) | If traders win net, pool loses. Yield can be negative over a period. Core risk of this tranche. |
| Backing asset price | Pool holds volatile collateral (ETH, BTC). Falls in ETH = falls in NAV. |
| Oracle risk | GMX prices come from its oracle system (Chainlink Data Streams). Oracle failure/manipulation → bad trades against LPs. |
| Withdrawal liquidity | Reserved liquidity + async execution → can't always exit on demand. |
| ADL / market limits | In synthetic markets or when PnL-to-pool thresholds are hit, auto-deleveraging kicks in; pool caps may block deposits. |
| Smart contract risk | GMX V2 contracts. GMX V1 was exploited in 2025 — separate code, but shows the attack surface. Monitor. |
| Execution fees / griefing | Every GMX action costs an ETH execution fee; small deposits can be uneconomical. Batch deposits. |
| Incentive decay | Part of historic APR came from incentive programs; when they end, yield drops. |

---

## Shared / vault-level

- **Keeper:** permissioned for timing, but critical actions (PT redemption at maturity, withdrawal settlement) should also be callable by anyone so a dead keeper can't lock funds.
- **Composability risk:** each dependency adds risk; the interaction between two safe contracts can still be unsafe. Audit the integration, not just our code.
- **Inflation attack on 4626:** use virtual shares/offset (OZ ERC4626 default) + seed deposit.
- **Pause + caps:** per-tranche TVL caps, pause for deposits (not withdrawals) at launch.
- **Arbitrum-specific:** sequencer downtime → check Chainlink sequencer uptime feed before pricing; GMX/Pendle oracles may also stall.

## Open questions
1. Is A really independent of B, or should B absorb A's shortfalls (true senior/junior tranching)? Changes the whole design.
2. Deposit asset(s)? One asset for both tranches, or separate?
3. Fixed rate in USD or ETH terms? → picks the Pendle underlying.
4. Early exit for A: disallow, or allow at market price?
5. At maturity: auto-roll or pay out?
6. B: single GM market, multiple, or GLV?
7. Is B's ETH price exposure acceptable?
8. Keeper: own infra, or Gelato/Chainlink Automation?
