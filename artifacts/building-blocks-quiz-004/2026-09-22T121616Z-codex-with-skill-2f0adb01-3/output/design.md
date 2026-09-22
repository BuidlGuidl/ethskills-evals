# Two-Tranche Yield Vault Design

## Goal

Build an Arbitrum vault where each deposit is allocated to one of two independent risk buckets:

- **Tranche A:** fixed-rate, maturity-dated exposure. The rate is locked when the user deposits.
- **Tranche B:** variable exposure to fees paid by leveraged traders. This tranche accepts market and trader-PnL risk in exchange for higher upside.

The vault should not present either tranche as risk-free. Tranche A targets a known maturity payoff through a fixed-yield instrument; Tranche B targets variable fee income from perps liquidity provision.

## Protocol Choices

| Tranche | Protocol | Position |
| --- | --- | --- |
| A | Pendle V2 on Arbitrum | Buy Principal Tokens (`PT`) for a whitelisted Pendle market and maturity whose accounting asset matches the vault asset. |
| B | GMX V2 on Arbitrum | Provide liquidity to whitelisted GM pools, preferably fully backed major markets such as ETH/USD or BTC/USD pools rather than synthetic long-tail markets. |

### Tranche A: Pendle PT

Tranche A deposits are routed into Pendle V2 Principal Tokens. Pendle splits a yield-bearing asset into:

- `SY`, the standardized wrapper around the yield-bearing source.
- `PT`, the principal claim redeemable at maturity in accounting-asset terms.
- `YT`, the claim on yield and rewards until maturity.

The vault buys `PT` at the deposit-time market price. The user's fixed rate is the implied return from that execution price to the maturity redemption value, net of vault fees, Pendle fees, swap slippage, and any configured reserve haircut.

Example: if a `PT` redeemable for 1 USDC-equivalent at maturity costs 0.96 USDC today, the gross fixed return to maturity is `1 / 0.96 - 1`, assuming successful settlement and no early exit.

The implementation should store each Tranche A deposit as a lot:

- asset amount deposited
- Pendle market
- maturity
- PT amount received
- fixed rate or fixed payout implied by the actual fill
- depositor address

At maturity, the keeper redeems matured `PT` through Pendle and makes the owed fixed payout claimable. If users exit early, they should receive the live liquidation value of their pro-rata `PT`, not the promised maturity payout.

### Tranche B: GMX V2 GM Pools

Tranche B deposits are routed into GMX V2 liquidity pools. In GMX V2, each GM pool backs a specific perpetual market. Liquidity providers receive GM tokens representing a share of the pool.

The vault should use an allowlist of GM markets and initially prefer:

- fully backed markets where the index token and long token align, such as ETH/USD backed by WETH plus USDC
- deep, high-volume markets with active borrow, trading, liquidation, and swap fee generation
- markets where deposits and withdrawals are enabled and pool caps leave room for keeper operations

Avoid default exposure to synthetic long-tail markets unless explicitly approved, because those pools can carry additional mismatch and auto-deleveraging risk.

## How Positions Earn

### Tranche A Earnings

Tranche A earns from the discount between the `PT` purchase price and its maturity redemption value. This behaves like a zero-coupon fixed-yield position:

1. User deposits into Tranche A.
2. Vault quotes and buys `PT` for the selected maturity.
3. The fixed payout is calculated from the actual received `PT`, not from a stale displayed APY.
4. No recurring coupon is required. The value accretes as the PT approaches par, subject to market pricing before maturity.
5. At maturity, the keeper redeems `PT` and the vault pays the fixed maturity claim.

Keeper responsibilities for Tranche A:

- batch deposits into Pendle with slippage limits
- track lot-level maturities and redemption assets
- redeem matured `PT`
- optionally roll matured principal into a new series only when the user or strategy configuration explicitly opts in

### Tranche B Earnings

Tranche B earns through GMX pool value growth. GMX pools collect fees from:

- leveraged position opens and closes
- borrow fees
- liquidations
- swaps, where applicable

Those fees increase the GM pool value, so holding GM tokens is the primary earning mechanism. Tranche B does not have a fixed maturity or fixed APY.

Keeper responsibilities for Tranche B:

- buy GM tokens with Tranche B deposits
- reinvest idle balances, rebates, and any claimable rewards into additional GM exposure
- maintain target weights across whitelisted GM markets
- avoid deposits when price impact, reserve usage, or pool caps make entry unattractive
- unwind or rebalance if a market becomes deposit-disabled, too illiquid, overly utilized, or governance-removes it from the whitelist

## Risk Profile

### Shared Vault Risks

- **Smart contract risk:** bugs in this vault, Pendle, GMX, token contracts, routers, or adapters can impair funds.
- **Keeper risk:** delayed or failed keeper actions can leave deposits idle, miss redemptions, accept stale quotes, or fail to rebalance.
- **Oracle and pricing risk:** both protocols depend on correct market pricing. Bad oracle data or manipulated pricing can affect execution and valuation.
- **Liquidity risk:** exits depend on available Pendle and GMX liquidity. During stress, quoted exits may be much worse than normal.
- **Slippage and MEV risk:** deposits, redemptions, and rebalances can receive worse execution than expected if limits are loose or transactions are exposed.
- **Governance/configuration risk:** wrong market allowlists, maturity choices, fee settings, or keeper permissions can shift risk between users.
- **Stablecoin/bridge risk:** if the vault uses bridged USDC, USDT, WETH, or WBTC, bridge failure, depeg, or token-specific issues affect both tranches.

### Tranche A Risks

- **Underlying asset risk:** a fixed PT payout is only as good as the accounting asset, the yield-bearing source, and Pendle settlement path.
- **Protocol risk:** Pendle, the SY adapter, or the underlying yield protocol can fail before maturity.
- **Early-exit risk:** the promised fixed rate applies only if held to maturity. Selling PT before maturity can realize a lower return or loss.
- **Rate-lock execution risk:** the user's fixed rate must be based on the actual trade fill. Price movement between quote and execution can reduce the locked rate.
- **Maturity concentration risk:** if all deposits target one maturity, operational or liquidity problems around that date affect many users at once.
- **Asset mismatch risk:** if the PT accounting asset differs from the user's deposit or desired withdrawal asset, conversion costs and price exposure can reduce realized payout.

### Tranche B Risks

- **Trader PnL risk:** GM pools are counterparties to leveraged traders. If traders profit, that value comes from the pool.
- **Market exposure risk:** multi-token GM pools expose LPs to the pool's long and short backing tokens, commonly a volatile asset plus a stablecoin.
- **Open-interest imbalance risk:** one-sided trader demand can increase pool risk even with funding, borrow fees, caps, and price impact mechanisms.
- **Liquidity and redemption risk:** high reserved liquidity or PnL factors can make withdrawals expensive, delayed, or temporarily unavailable.
- **Synthetic market risk:** synthetic GM markets can be exposed to mismatch between the index token and backing collateral; these should require explicit approval.
- **Variable yield risk:** fee income depends on trader activity, utilization, volatility, and market share. Yield can fall sharply.
- **Auto-deleveraging and parameter risk:** GMX risk controls protect pool solvency but can change outcomes for LPs during stress.

## Design Constraints For Implementation

- Separate accounting between tranches. Tranche B upside should not silently subsidize Tranche A unless the product explicitly defines a reserve or waterfall.
- Store Tranche A fixed payouts per deposit lot using actual execution amounts.
- Use conservative slippage limits and deadline checks for all protocol interactions.
- Restrict strategies to governance-approved Pendle markets, maturities, and GMX pools.
- Treat strategy APYs as display data only. Contract accounting should use balances, PT redemption amounts, GM token value, and executed fills.
- Make keeper actions permissioned but replaceable, with emergency pause and manual redemption paths.

## References

- Pendle docs: https://docs.pendle.finance/
- OpenPendle mechanics summary: https://docs.openpendle.com/concepts/how-pendle-works
- GMX V2 liquidity docs: https://docs.gmx.io/docs/providing-liquidity/
