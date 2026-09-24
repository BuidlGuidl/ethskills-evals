# Two-Tranche Yield Vault — Design

Chain: Arbitrum One. Base asset: USDC (native, not USDC.e).

| | Tranche A — Fixed | Tranche B — Trader fees |
|---|---|---|
| Protocol | Pendle V2 (Principal Tokens) | GMX V2 (GM pools / GLV vaults) |
| Position held | PT-<asset>-<maturity> | GM or GLV token |
| Return type | Fixed, known at deposit | Variable, can be negative |
| Paid out | At maturity | Anytime (async withdraw) |

---

## Tranche A — Pendle PT

### Why Pendle
Pendle splits a yield-bearing token (e.g. aUSDC, sUSDe, wstETH) into:
- **PT** (Principal Token): redeemable 1:1 for the underlying at maturity.
- **YT** (Yield Token): gets all yield until maturity.

PT trades at a discount before maturity. Buying PT at a discount and holding
to maturity = fixed rate. This is exactly "rate locked at deposit, paid at
maturity", with no counterparty inside our vault needed to guarantee it.

### How it earns
1. User deposits USDC.
2. Vault swaps USDC → PT on the Pendle market (via Pendle Router).
3. Fixed rate for that user = `(PT received / USDC in) ^ (1 / years to maturity) - 1`.
   Recorded per deposit, so each depositor gets their own locked rate.
4. At maturity, PT redeems 1:1 for the underlying → vault converts to USDC → user claims.

The gain is just the discount closing to zero. No rewards, no fees to collect.

### Accounting
- One cohort per maturity. User position = amount of PT owned (not a share of a pool).
- Payout at maturity = PT amount redeemed. Rate differences between users fall
  out naturally (earlier/later buyers got more/less PT per USDC).
- Pre-maturity valuation (for UI / early exit): use Pendle's PT oracle (TWAP),
  never spot AMM price.

### Keeper role
There is nothing to compound on a PT before maturity. Keeper jobs:
- At maturity: redeem PT → underlying → USDC.
- Optional: roll users who opted in into the next maturity (new rate = market rate at roll time, not the old one).

### Risks
- **Underlying risk**: PT is only worth what the underlying is worth at maturity.
  If PT-sUSDe and USDe depegs, or PT-aUSDC and Aave has bad debt, the "fixed"
  rate is not delivered. Pick underlying carefully — this is the main risk.
- **Unit of the fixed rate**: fixed in terms of the underlying, not USD.
  PT-wstETH is fixed in ETH terms → user has ETH price exposure. For a USD
  fixed rate, only use stablecoin underlyings.
- **Early exit**: selling PT before maturity is at market price. If rates rose,
  user gets less than deposit-plus-accrued. Either forbid early exit or disclose clearly.
- **Liquidity / slippage at entry**: large deposits move the PT price → lower
  rate. Need min-PT-out slippage check; cap deposit size vs pool depth.
- **Market expiry**: once a market matures there is no new PT to buy in it; vault
  must only offer active maturities with enough time left.
- **Smart contract risk**: Pendle router/markets/SY wrappers + underlying protocol.
- **Rollover rate risk**: rolled positions get whatever rate the market offers then.

---

## Tranche B — GMX V2 liquidity

### Why GMX V2
GMX is the largest perp exchange on Arbitrum. Liquidity providers (LPs) in GM
pools are the counterparty to leveraged traders and earn most of the fees they pay.
Use V2 only — GMX V1 / GLP is deprecated (V1 was exploited in July 2025).

Options:
- **GM pool** (e.g. ETH/USD [WETH-USDC]): one market, direct exposure.
- **GLV** (e.g. GLV [WETH-USDC]): wraps several GM pools with the same
  backing tokens and rebalances between them. Simpler for a vault. **Recommended default.**
- Alternative if we want diversification: gTrade (Gains Network) gUSDC vault, also on Arbitrum.

### How it earns
LPs get (share set by GMX governance, check current values):
- Open/close position fees.
- Borrow fees (traders pay for open interest).
- Part of funding fees, swap fees, price-impact fees.
- Plus/minus **trader PnL**: when traders lose, pool gains; when they win, pool pays.
- Occasional incentives (ARB / GMX rewards), paid separately.

Fees accrue into the GM/GLV token price automatically. Holding the token = compounding.

### Keeper role
- Claim incentive rewards (if any) → swap to USDC → deposit back into GM/GLV.
- Execute deposits/withdrawals: GMX V2 is two-step (request, then GMX keeper
  executes with oracle prices). Vault must track pending requests and pay
  execution fees in ETH.
- Batch user deposits to save execution fees.

### Risks
- **Trader PnL**: if traders win big, pool value drops. This is the core risk
  B is being paid for.
- **Market exposure**: a WETH-USDC pool holds ~50% WETH. B has ETH price risk
  unless hedged. A USDC-only exposure is not available in GM pools with real volume.
- **Withdrawal limits**: liquidity reserved for open interest can't be withdrawn.
  In stress, withdrawals may be delayed or partial.
- **Async flow**: deposit/withdraw requests can be cancelled by GMX (e.g. slippage,
  price move). Vault share accounting must handle pending state; don't mint/burn
  shares until execution callback.
- **Oracle risk**: GMX uses Chainlink Data Streams; bad prices → bad trades against LPs.
- **ADL** (auto-deleveraging) and pool caps can change behavior in extreme markets.
- **Smart contract risk**: GMX V2 contracts, GLV, our callback handling.
- **Share price manipulation**: value GM via GMX Reader with oracle prices,
  not spot; use delayed/settled pricing for mint/redeem.
- **Parameter risk**: GMX governance can change fee splits, caps, markets.

---

## Shared / vault-level risks
- **Keeper risk**: keeper swaps (rewards → USDC, USDC → PT) need slippage limits
  and private submission where possible. Keeper failure must not lock funds —
  users should be able to redeem matured PT / exit B without the keeper.
- **Admin keys**: timelock on strategy changes; no ability to move user funds
  to arbitrary addresses.
- **Arbitrum sequencer downtime**: pause deposits when sequencer is down
  (Chainlink sequencer uptime feed).
- **Tranches are independent**: B does NOT backstop A. A's fixed rate comes from
  Pendle, not from B's capital. (If we want B to cover A's shortfall, that is a
  different, much riskier design — see questions.)

## Open questions
1. Should B subordinate A (B absorbs A losses for extra yield), or keep tranches fully separate as above?
2. Base asset for A: USDC-only fixed rate, or also ETH-denominated PT?
3. Which Pendle underlying(s)? Trade-off: higher rate (sUSDe) vs safer (aUSDC).
4. Early exit for A: allowed at market price, or locked until maturity?
5. B: accept ETH exposure in GLV, or hedge it?
6. Auto-roll A at maturity by default, or opt-in?
