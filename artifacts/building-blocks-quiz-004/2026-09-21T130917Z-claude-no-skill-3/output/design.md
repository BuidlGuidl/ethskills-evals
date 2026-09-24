# Two-Tranche Yield Vault — Design

Chain: Arbitrum One.

## Summary

| | Tranche A (fixed) | Tranche B (trader fees) |
|---|---|---|
| Protocol | Pendle V2 — Principal Tokens (PT) | GMX V2 — GM pools (or GLV vaults) |
| Position | PT of one Pendle market, held to expiry | GM tokens of chosen market(s) |
| Yield source | PT bought below face value, redeemed 1:1 at expiry | Fees traders pay: open/close, borrow, swap, share of price impact |
| Rate | Fixed at purchase, if held to maturity | Variable, can be negative |
| Main risks | Underlying asset/depeg, early exit at market price, Pendle/SY contracts | Trader PnL, price exposure to backing tokens, withdrawal limits, GMX contracts/oracles |

The tranches are **independent**. B does not cover A's losses, and A does not
cap B's gains. (If you want B to backstop A's rate, that's a senior/junior
structure. It's a different design; see open questions.)

---

## Tranche A — fixed rate via Pendle PT

### Protocol
Pendle V2 on Arbitrum. Pendle splits a yield-bearing asset (wrapped as an
**SY**, "standardized yield" token) into:
- **PT** (principal token): redeems for 1 unit of the underlying's accounting asset at expiry.
- **YT** (yield token): receives all variable yield until expiry.

The vault buys and holds **PT only**.

Market choice: one Pendle market on Arbitrum whose underlying is the asset
users think in (e.g. a USD stable for a USD fixed rate) and whose **expiry
= the tranche maturity date**. Tranche maturity dates must come from existing
Pendle expiries. We can't pick them freely. Check available markets,
liquidity and SY underlying when we build it; Arbitrum markets and their
depth change often.

### How it earns
- Deposit: underlying → swap on the Pendle AMM into PT at a discount (e.g. pay 0.95, get 1.00 at expiry).
- The implied yield of that discount, annualized to expiry, is the fixed rate.
- Hold to expiry → redeem PT 1:1 for the underlying → pay user principal + fixed yield.
- No harvesting. PT value rises toward 1.00 on its own; nothing to claim.

### Rate locking: per deposit, not per vault
Each deposit buys PT at the price at that moment, so every depositor gets a
different rate. Accounting must track **PT units per user** (or per deposit
lot), not a shared share price. The user's locked rate is the one from
**their actual fill** (after slippage and vault fee), shown before confirmation
with a min-PT-out check. Don't quote a rate from an oracle.

### Keeper role
"Compounding" doesn't really apply to A:
- no rewards to reinvest while holding PT (except possible PENDLE/incentive
  rewards if the vault also LPs, which we don't in this design);
- keeper jobs are: redeem PT at expiry, optionally **roll** into the next
  expiry's PT for users who opt in (new rate = market rate at roll time, not the old one).

### Risks
- **Underlying risk**: the fixed rate is in units of the SY's accounting asset. If the underlying (e.g. a synthetic stable, an LST) depegs or its issuer fails, PT redeems for a devalued asset. "Fixed" ≠ "risk-free".
- **Early exit**: before expiry, PT can only be sold on the Pendle AMM at the market price. If rates rose or liquidity is thin, the user gets less than principal + accrued. Fixed rate only holds to maturity.
- **Liquidity**: shallow Arbitrum PT pools → high slippage on deposit (lower locked rate) and on early exit. Need per-deposit size caps.
- **Smart contract**: Pendle router/market/SY contracts, plus the underlying protocol's contracts.
- **Maturity mismatch**: tranche maturity must equal a Pendle expiry; after expiry PT stops earning until redeemed/rolled.
- **Rate promise**: the vault must never promise more than the PT fill gives. No reserve covers a shortfall.

---

## Tranche B — trader fees via GMX V2

### Protocol
GMX V2 on Arbitrum. LPs deposit into **GM pools**, one per market (e.g.
ETH/USD backed by WETH + USDC). Optional: **GLV** vaults, which hold several GM
tokens sharing the same backing pair and rebalance between them.

(Not GMX V1 / GLP: V1 was exploited in July 2025 and wound down.)

### How it earns
The GM pool is the counterparty to leveraged traders. Pool value grows from:
- open/close position fees,
- borrow fees (hourly fee traders pay for open interest),
- swap fees,
- positive price impact kept by the pool,
- traders' losses (liquidations and losing positions).

A share of fees goes to GMX stakers/treasury; the LP share accrues straight into
the GM token price. No claim needed.

And it loses from:
- traders' **profits** (the pool pays them),
- price moves of backing tokens (a WETH/USDC pool is partly long ETH).

### Keeper role
- Fees auto-accrue in GM price, so there's no fee compounding in the usual sense.
- Keeper jobs: claim and reinvest any incentive tokens (if a program is live), rebalance between GM markets/GLV if we hold several, handle pending deposit/withdrawal requests.

### Integration constraint: async deposits/withdrawals
GMX V2 deposits and withdrawals take two steps: the vault creates a request (paying
an ETH execution fee), then GMX keepers execute it in a later tx using oracle
prices and call back. So vault deposits/withdrawals for B must also be
async: pending states, callbacks, handling cancelled requests, execution-fee
accounting. Share price must not be computed from stale GM prices between
request and execution.

### Risks
- **Trader PnL**: a run of winning traders (strong trend) reduces pool value. Yield can be negative over weeks.
- **Market exposure**: GM value moves with the backing tokens (e.g. ETH half of an ETH/USD pool). Not a stable-denominated yield.
- **Withdrawal limits**: withdrawals can be blocked or limited when liquidity is reserved for open interest or pending trader PnL is high, which is exactly when users want out.
- **Oracle risk**: GMX relies on its oracle setup (Chainlink Data Streams + keepers). Bad prices → bad trades/execution against the pool.
- **Smart contract / exploit**: GMX V2 contracts; plus the V1 precedent.
- **Keeper dependency**: GMX's own keepers must execute our requests; if they're down, funds sit pending.
- **Parameter changes**: GMX governance changes fee splits, caps, impact factors, which directly changes our yield.

---

## Shared risks

- **Arbitrum**: sequencer downtime (no txs, stale prices), L2 bridge/upgrade risk, Arbitrum DAO security council powers.
- **Asset variants**: native USDC vs bridged USDC.e. Pick native, and check which one each market uses.
- **Our vault**: our own contracts, keeper key compromise, keeper downtime (missed redemptions/rolls). Keeper should only be able to call bounded actions (slippage limits, allowlisted targets), never move funds out.
- **Upgradeability/admin**: who can pause, change markets, upgrade. Timelock needed.

---

## Open questions
1. Should B backstop A (senior/junior), or keep them independent as written?
2. Tranche A underlying: which asset (USD stable vs ETH)? Decides which Pendle markets qualify.
3. Maturity: fixed vault-wide dates (matching Pendle expiries) or per-user roll?
4. Early exit from A: allow at market price, or lock until maturity?
5. Tranche B: single GM market, several, or GLV?
6. Vault fee model: on yield, on deposit, or spread on A's quoted rate?
