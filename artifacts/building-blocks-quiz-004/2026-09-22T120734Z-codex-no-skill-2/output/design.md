# Two-Tranche Yield Vault Design

## Scope and Assumptions

This vault is designed for Arbitrum and accepts a stable deposit asset, assumed to be USDC for the first version. Users choose one tranche at deposit time:

- **Tranche A:** fixed-rate, fixed-maturity exposure.
- **Tranche B:** variable, higher-risk exposure to fees paid by leveraged traders.

The vault should not commingle accounting between tranches. Each tranche has its own asset accounting, share price, risk budget, and unwind path. The keeper operates both strategies, but it does not change the economic promise made to users at deposit time.

## Tranche A: Fixed Rate at Maturity

### Protocol

Tranche A deploys into **Pendle Principal Tokens (PTs)** on Arbitrum.

For each supported maturity, the vault buys a Pendle PT market whose maturity matches, or is earlier than, the vault maturity. The preferred market is a stable-denominated PT with deep liquidity, low slippage, and an underlying asset the vault would be comfortable holding directly. Examples of eligible market types are PTs backed by conservative stable yield sources; the exact PT market should be selected during deployment configuration, not hard-coded into the design.

Pendle is the right primitive because PTs represent the principal side of a yield-bearing asset and trade at a discount before maturity. Holding PT to maturity converts that discount into fixed yield. Pendle documentation describes this as buying PT below the underlying asset value and redeeming 1:1 for the underlying asset at or after maturity.

### How the Position Earns

When a user deposits into Tranche A:

1. The vault quotes the current Pendle PT price, swap route, slippage, and maturity.
2. The vault locks the user's fixed rate based on the actual PT amount acquired after fees and slippage.
3. The vault holds PT until maturity.
4. At or after maturity, the keeper redeems PT into the underlying asset.
5. The vault swaps or unwraps the redeemed asset back to the deposit asset if needed.
6. The user receives the promised maturity amount, subject to the risk disclosures below.

The yield is not produced by periodic compounding. It is the accretion from the PT purchase discount to its maturity redemption value. The keeper's role is operational:

- execute deposits into the selected PT market;
- claim or handle any associated rewards if the selected market has them;
- redeem matured PT;
- roll idle matured capital into a new maturity only for users or vault series that explicitly opt in;
- maintain reserves for slippage, failed transactions, and small rounding differences.

### Risks

Tranche A is lower risk than Tranche B, but it is not risk-free.

- **Underlying asset risk:** The PT redeems into the underlying yield-bearing asset, not necessarily plain USDC. If the underlying stablecoin, wrapper, or yield-bearing token depegs or loses value, Tranche A can lose money.
- **Pendle smart contract risk:** A bug or exploit in Pendle's contracts, market contracts, or SY wrappers could impair redemption.
- **Underlying protocol risk:** The PT's underlying asset may depend on another protocol, custodian, bridge, oracle, or strategy. That dependency must be risk-reviewed before adding a market.
- **Liquidity risk before maturity:** If the vault must exit early, PT may trade at a discount or with high slippage.
- **Maturity mismatch risk:** If the selected PT matures after the vault maturity, the vault cannot make a clean fixed-maturity promise. The strategy should only use PTs that mature on or before the tranche's maturity date.
- **Rate-lock execution risk:** The user's fixed rate is only valid after the vault actually acquires PT. The deposit flow must use slippage bounds and revert if execution would produce less PT than required for the quoted rate.
- **Stable swap and unwrap risk:** If redemption produces a non-USDC asset, the final conversion back to USDC can suffer slippage, liquidity failure, bridge risk, or depeg risk.

## Tranche B: Leveraged Trader Fee Exposure

### Protocol

Tranche B deploys into **GMX V2 GM or GLV liquidity pools** on Arbitrum.

The first version should prefer major, liquid, fully backed GMX markets or diversified GLV pools rather than small synthetic markets. The pool allowlist should be governance-controlled and based on:

- total liquidity and withdrawal capacity;
- utilization and open interest caps;
- historical fee generation;
- exposure to long and short backing tokens;
- whether the market is fully backed or synthetic;
- whether deposits and withdrawals are currently enabled.

GMX is the right primitive because GM and GLV pools back swaps and leveraged trading. Liquidity providers earn a share of trading, liquidation, borrowing, and swap fees on Arbitrum, while also taking the other side of trader PnL.

### How the Position Earns

When a user deposits into Tranche B:

1. The vault converts the deposit asset into the token mix required by the selected GM or GLV pool.
2. The vault mints or buys GM/GLV liquidity tokens.
3. Fees paid by GMX traders flow into the pool.
4. Those fees increase the pool value and therefore the GM/GLV token price.
5. The keeper periodically harvests any external incentives, rebalances between allowlisted pools if configured, and compounds idle assets back into GM/GLV.
6. On withdrawal, the vault sells GM/GLV back into the deposit asset, subject to available liquidity, price impact, and slippage controls.

Unlike Tranche A, Tranche B has no promised rate. Its return is variable and depends on trader activity, borrow utilization, liquidation volume, swap volume, trader PnL, pool composition, and backing-token prices.

### Risks

Tranche B accepts materially more risk in exchange for the fee stream.

- **Trader PnL risk:** GMX liquidity providers are the counterparty to traders. If traders are profitable, those profits come out of pool value.
- **Backing-token price risk:** Multi-token GM/GLV pools hold long and short backing assets. The vault can lose value from adverse movement in those assets, even if fees are positive.
- **Open interest imbalance risk:** Long or short imbalances can make the pool sensitive to sharp price moves and liquidation cascades.
- **Synthetic market risk:** In synthetic markets, the index token can move differently from the backing token. Extreme divergence can stress the pool's ability to cover trader profits.
- **Liquidity and withdrawal risk:** Withdrawals can be delayed or become expensive when pool liquidity is reserved for open positions or when redemption price impact is high.
- **GMX smart contract and oracle risk:** Bugs, oracle failures, delayed execution, or keeper/execution issues in GMX can affect pool pricing and withdrawals.
- **Fee variability risk:** Trading volume, borrow demand, and liquidation activity can fall, reducing yield.
- **Compounding risk:** Keeper mistakes, stale pool selection, bad rebalancing, or compounding during adverse price impact can reduce returns.
- **Bridge and token risk:** Arbitrum assets may include bridged tokens or pegged tokens with their own depeg, bridge, and issuer risks.

## Keeper Responsibilities

The keeper is an operational agent, not a guarantor.

For Tranche A, the keeper:

- executes PT purchases with strict minimum-output checks;
- monitors maturity dates;
- redeems matured PT;
- converts redeemed assets back to the deposit asset;
- rolls into a new PT only for explicitly configured new series.

For Tranche B, the keeper:

- compounds rewards or idle balances;
- monitors GMX pool liquidity, utilization, open interest, and deposit/withdrawal availability;
- rebalances only among governance-allowlisted pools;
- avoids deposits or withdrawals when price impact exceeds configured limits;
- pauses new Tranche B deposits if the pool state breaches risk limits.

## Risk Separation Between Tranches

The vault should account for Tranche A and Tranche B independently.

Tranche A users should not absorb Tranche B trader PnL, backing-token volatility, or GMX liquidity losses. Tranche B users should not receive the fixed-rate claim promised to Tranche A. If both tranches share a top-level vault contract, each tranche still needs separate accounting for:

- total assets;
- shares;
- pending deposits;
- pending withdrawals;
- strategy positions;
- realized and unrealized PnL;
- fees;
- emergency unwind state.

Any reserve or insurance mechanism must be explicitly defined. Without an explicit reserve, Tranche A's fixed rate is only as strong as the PT redemption path and selected underlying asset.

## External References

- Pendle fixed yield with PT: https://docs.pendle.finance/pendle-academy/optimizing-yields-with-pendle/chapter-3.1-fixed-yield-on-pendle
- Pendle deployments and Arbitrum support: https://docs.pendle.finance/pendle-v2-dev/Deployments
- GMX liquidity provider mechanics and risks: https://docs.gmx.io/docs/providing-liquidity/
