# Two-Tranche Yield Vault Design

## Scope

The vault runs on Arbitrum and accepts one accounting asset, assumed to be a stablecoin such as USDC. Depositors choose one of two tranches at deposit time:

- **Tranche A:** fixed-rate, fixed-maturity exposure.
- **Tranche B:** variable, higher-risk exposure to fees paid by leveraged traders.

The vault should not manufacture yield internally. Each tranche maps to a protocol position whose economics match the promised payoff.

## Protocol Allocation

### Tranche A: Pendle Principal Tokens

Tranche A deploys into **Pendle PT markets on Arbitrum**.

For each supported maturity, the vault maintains a whitelist of Pendle Principal Tokens whose accounting asset matches, or can be tightly converted into, the vault accounting asset. Examples of eligible categories are PTs for liquid stablecoin yield assets or other conservative yield-bearing assets with enough Pendle liquidity.

At deposit time, the vault quotes a fixed rate from the executable PT purchase price, less protocol fees, keeper buffers, and slippage reserves. The user receives a maturity claim against that specific PT maturity. The vault immediately buys the PT needed to cover the promised maturity payout.

This means the fixed rate is not an abstract vault promise. It is hedged by the fact that PTs are purchased at a discount and redeem at maturity for the relevant accounting asset of the Pendle market, assuming the underlying asset and protocol remain solvent.

### Tranche B: GMX V2 GM or GLV Liquidity

Tranche B deploys into **GMX V2 liquidity on Arbitrum**, using either selected GM market pools or a GLV vault that allocates across GM pools.

The preferred default is a conservative basket of major, fully backed GM markets, such as ETH/USD and BTC/USD-style pools backed by the market asset plus stablecoin collateral. A GLV can be used when we want GMX-native allocation across several GM pools; direct GM positions can be used when the vault wants tighter risk controls per market.

Tranche B receives the residual, variable return from supplying liquidity to leveraged trading markets. It is the risk-bearing tranche and should not quote a fixed APY.

## How Positions Earn

### Tranche A Earnings

Pendle splits a yield-bearing asset into:

- **SY:** the standardized wrapped yield-bearing asset.
- **PT:** the principal claim redeemable at maturity.
- **YT:** the future yield claim until maturity.

Tranche A earns by buying PT below its maturity redemption value. As time passes, the PT price should converge toward par, and at maturity the PT can be redeemed through Pendle for the underlying accounting asset of that market.

Example:

1. A user deposits 1,000 USDC into Tranche A for a six-month maturity.
2. The vault computes the executable fixed rate from the current PT price.
3. The vault buys enough PT to satisfy the user's promised maturity amount.
4. At maturity, the keeper redeems PT and the user can withdraw principal plus the locked fixed return.

The keeper's role for Tranche A is operational rather than alpha-seeking:

- buy PT after deposits within strict slippage limits;
- redeem matured PT;
- convert redemption assets back to the vault accounting asset when necessary;
- sweep small residual balances;
- roll matured capital only for users who explicitly opt into a new maturity.

### Tranche B Earnings

GMX V2 liquidity pools back leveraged trading and swaps. Liquidity providers hold GM pool tokens, or GLV tokens when using a GMX liquidity vault.

Tranche B earns from the fees and value flows paid into those pools, including:

- leveraged trading fees;
- borrowing fees paid by open leveraged positions;
- liquidation fees;
- swap fees;
- any claimable protocol incentives, if enabled for the chosen pool.

These returns are not a coupon. They accrue through the value of the GM or GLV position, net of trader profit and loss. When traders lose to the pool and pay fees, the liquidity position benefits. When traders win against the pool, the liquidity position can lose value.

The keeper compounds Tranche B by:

- claiming any external incentives;
- swapping rewards into the target deposit assets;
- minting additional GM or GLV shares;
- rebalancing between approved GM markets when allocations drift;
- enforcing exposure limits before adding more capital to any single market.

## Risk Profile

### Tranche A Risks

Tranche A is lower risk than Tranche B, but it is not risk-free.

- **Underlying asset risk:** PT redemption depends on the underlying yield-bearing asset. If that asset depegs, pauses redemptions, suffers insolvency, or changes redemption mechanics, the fixed payout can be impaired.
- **Pendle protocol risk:** Pendle market, SY adapter, router, oracle, or redemption logic could fail or be exploited.
- **Liquidity and execution risk:** The quoted fixed rate depends on actually buying PT at the expected price. Deposits should revert if slippage exceeds the quote buffer.
- **Maturity mismatch risk:** A fixed claim must be matched to PT of the same maturity. The vault should not use short-dated or long-dated PT to back a different promised maturity without explicit risk rules.
- **Early exit risk:** Users exiting before maturity may receive a market price for their claim, not the promised maturity value.
- **Keeper risk:** Failed or delayed keeper actions can leave deposits uninvested, delay redemption, or miss conversion windows.
- **Accounting asset mismatch:** Some PTs redeem into a yield-bearing token or accounting asset that must be converted back to the vault asset. That conversion can introduce slippage, liquidity, and depeg risk.

Controls:

- whitelist PT markets by maturity, liquidity, underlying asset quality, and redemption path;
- lock each deposit's fixed rate only after executable quotes pass slippage checks;
- reserve a small buffer before quoting user-facing fixed rates;
- segregate accounting by maturity;
- disable new deposits into a maturity as it approaches expiry or loses liquidity.

### Tranche B Risks

Tranche B is the junior, variable-return tranche and absorbs materially more risk.

- **Trader PnL risk:** GMX liquidity is the counterparty to leveraged traders. If traders are profitable against the pool, GM or GLV value can fall.
- **Market skew risk:** Large one-sided long or short interest can make pool returns sensitive to sharp price moves.
- **Volatility risk:** Fast markets can increase liquidations and fees, but can also create large trader wins, oracle stress, and rebalancing losses.
- **Oracle and execution risk:** GMX relies on oracle-based pricing and delayed execution flows. Bad data, stale prices, or execution disruption can harm LPs.
- **Pool composition risk:** GM markets hold long and short assets. LPs are exposed to changes in those asset prices and to the balance between them.
- **Synthetic market risk:** Synthetic GM markets can involve more complex risk controls, including auto-deleveraging behavior. The vault should prefer fully backed major markets unless governance approves otherwise.
- **Smart contract risk:** GMX contracts, reward contracts, integrations, and keeper transaction paths can fail or be exploited.
- **Liquidity risk:** Exiting GM or GLV positions can be delayed, incur price impact, or be limited during stressed conditions.
- **Incentive risk:** Any rewards beyond core trading economics may change, stop, or become uneconomic to claim.

Controls:

- cap allocation per GM market;
- prefer major fully backed markets for the default strategy;
- set maximum drawdown and maximum market-skew thresholds;
- pause new Tranche B deposits during oracle incidents, extreme volatility, or GMX withdrawal stress;
- require keeper transactions to respect minimum-out and maximum-price-impact checks;
- report Tranche B APY as realized and variable, never fixed.

## Tranche Interaction

The safest accounting model is to keep Tranche A and Tranche B economically separate:

- Tranche A deposits buy Pendle PT backing for that maturity.
- Tranche B deposits buy GM or GLV exposure.
- Tranche B does not subsidize Tranche A unless the protocol explicitly defines a reserve or first-loss mechanism.

If the product later wants Tranche B to be a formal junior tranche protecting Tranche A, that needs an explicit waterfall:

1. Tranche A receives its promised maturity payout first.
2. Losses beyond Tranche A's Pendle backing are charged to a reserve or Tranche B.
3. Tranche B receives remaining excess yield after all senior claims and fees.

That waterfall is a stronger structured-product design, but it also makes Tranche B responsible for risks it does not directly control. The initial design should avoid cross-subsidy unless the vault is intentionally marketed as senior/junior credit exposure.

## Initial Recommendation

Use **Pendle PTs for Tranche A** and **GMX V2 GM/GLV liquidity for Tranche B**.

This maps each user promise to a matching DeFi primitive:

- Pendle PTs naturally express fixed-rate, fixed-maturity yield.
- GMX liquidity naturally expresses variable exposure to fees paid by leveraged traders.

The keeper should automate execution, compounding, redemption, reward claiming, and risk-limit enforcement. It should not be allowed to override tranche economics or chase unsupported markets without governance approval.
