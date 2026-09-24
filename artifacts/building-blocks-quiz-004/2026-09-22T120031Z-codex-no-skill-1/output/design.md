# Two-Tranche Yield Vault Design

## Scope and Assumptions

This vault is deployed on Arbitrum and accepts a stable accounting asset, assumed to be USDC. Users choose a tranche at deposit time:

- **Tranche A** is the fixed-rate tranche. The quoted rate is locked for that user at deposit time and pays at a defined maturity date.
- **Tranche B** is the variable, higher-risk tranche. It earns fees paid by leveraged traders and absorbs the market risk attached to that fee source.

The first implementation should treat the tranches as separate strategy buckets with separate accounting. Tranche A should not rely on Tranche B to subsidize its fixed rate unless an explicit junior-loss waterfall is added later.

## Tranche A: Fixed-Rate Maturity Position

### Protocol

Tranche A deploys into **Pendle V2 on Arbitrum**, buying Principal Tokens (PTs) for an approved stable or low-volatility yield-bearing market.

Preferred initial market selection:

- A USDC-accounting PT market where the PT redeems 1:1 for USDC or a USDC-equivalent accounting asset at maturity.
- Deep enough liquidity for expected vault deposit and withdrawal sizes.
- Maturity that matches, or slightly exceeds, the vault maturity offered to users.

If no suitable USDC-accounting PT market is available for the exact maturity, the vault should not quote a fixed rate for that maturity.

### How the Position Earns

Pendle PTs trade at a discount to their accounting asset before maturity. Buying PT below its maturity redemption value creates the fixed yield.

Example flow:

1. User deposits USDC into Tranche A.
2. The vault quotes the user a fixed maturity amount based on the executable PT price, slippage, fees, and a reserve buffer.
3. The vault swaps the deposit into the selected PT.
4. At maturity, the PT is redeemed for the accounting asset.
5. The user receives the promised fixed payout, less any explicitly disclosed vault fees.

The keeper's role is operational rather than yield-discovery:

- Batch new deposits into PT purchases.
- Enforce slippage limits.
- Redeem matured PTs.
- Roll idle or matured capital into the next approved maturity only when users have opted into a new term.

Tranche A should quote from executable onchain liquidity, not from a displayed APY alone. The fixed rate is the discount captured at the actual fill price.

### Risks

- **Underlying asset risk:** PT redemption is only as good as the accounting asset and underlying yield-bearing asset. If the asset depegs, is paused, or suffers a loss, the fixed promise can fail.
- **Pendle smart contract risk:** The tranche depends on Pendle's tokenization, market, oracle, and redemption contracts.
- **Liquidity risk before maturity:** Exiting early may require selling PT into thin liquidity at a discount. The vault should either disallow early withdrawal or price it at executable market value.
- **Maturity mismatch risk:** If user maturity and PT maturity differ, the vault can be exposed to reinvestment risk, idle capital drag, or forced secondary-market sales.
- **Execution risk:** Slippage, routing errors, MEV, and stale quotes can make the acquired PT amount insufficient to support the promised payout.
- **Keeper risk:** Missed redemption or batching transactions can delay payouts, though it should not change the final PT redemption claim after maturity.

## Tranche B: Leveraged-Trader Fee Position

### Protocol

Tranche B deploys into **GMX V2 on Arbitrum**, using GMX liquidity tokens:

- Prefer **GMX GLV pools** for diversified liquidity across approved GM markets when broad fee exposure is desired.
- Use individual **GM pools** when the vault wants isolated exposure to a specific market, such as ETH/USD [WETH-USDC].

The initial conservative default is a highly liquid, fully backed GM or GLV pool using blue-chip collateral, such as WETH and USDC. Synthetic or thinly traded markets should be excluded until governance explicitly approves them.

### How the Position Earns

GMX liquidity backs leverage trading and swaps. Traders pay trading fees, borrowing fees, liquidation fees, and swap fees. A share of those fees flows into the GMX liquidity pool and increases the value of the GLV or GM token over time.

Example flow:

1. User deposits USDC into Tranche B.
2. The vault mints or buys the selected GLV/GM token, subject to pool caps, price impact, and slippage checks.
3. Leveraged traders use the pool as counterparty liquidity.
4. Fees accrue into the pool, raising the GLV/GM token value.
5. The keeper periodically compounds any separately claimable incentives, if present, by swapping them back into the deposit asset or pool constituents and minting more GLV/GM.

For GMX V2 fee accrual, the core compounding is mostly automatic because fees increase pool value directly. The keeper is still needed for:

- Reinvesting external incentive rewards, if any.
- Rebalancing between approved pools.
- Respecting deposit caps and liquidity availability.
- Harvesting, accounting snapshots, and risk-off exits.

### Risks

- **Trader PnL / counterparty risk:** The pool is counterparty to leveraged traders. When traders profit, pool value decreases; when traders lose, pool value increases.
- **Asset exposure risk:** Multi-token pools expose LPs to the long and short backing assets. A WETH-USDC pool is not the same as holding only USDC.
- **Market imbalance risk:** Long/short open interest, utilization, funding, borrowing rates, and pool composition can change returns materially.
- **Liquidity and redemption risk:** Redemptions can be limited by reserve factors, open interest caps, pool caps, or temporarily unavailable liquidity.
- **Price impact risk:** Deposits and withdrawals can incur positive or negative price impact depending on whether they improve pool balance.
- **Synthetic market risk:** In synthetic markets, the index token can move differently from the backing collateral, creating solvency and PnL stress under extreme moves.
- **Oracle and liquidation risk:** GMX depends on oracle prices and liquidation mechanics. Faulty prices or delayed updates can harm LPs.
- **Smart contract and governance risk:** The tranche depends on GMX contracts, risk parameters, keepers, governance changes, and integrations used for routing.
- **Bridge and token risk:** Arbitrum bridged assets and stablecoins can depeg, pause, or suffer bridge-related failures.

## Shared Vault Controls

- **Separate accounting:** Track deposits, shares, fees, and PnL independently for each tranche.
- **Maturity buckets for Tranche A:** Each fixed-rate deposit belongs to a specific maturity bucket with its own PT market, entry price, promised payout, and redemption path.
- **No stale quotes:** A fixed-rate quote expires quickly and must include max slippage, protocol fees, vault fees, and a safety buffer.
- **Allowlist markets:** Governance should approve Pendle PT markets and GMX GLV/GM pools individually.
- **Emergency exits:** Define clear conditions for pausing deposits, disabling new fixed-rate quotes, selling PT before maturity, or exiting GMX liquidity.
- **Keeper permissions:** Keepers may compound, roll, redeem, and rebalance only within governance-approved markets and parameter limits.
- **Transparent reporting:** Publish tranche NAV, current strategy holdings, maturity schedule, realized yield, unrealized PnL, and known capacity limits.

## External References

- Pendle V2 documentation: https://docs.pendle.finance/
- Pendle PT mechanics: https://docs.pendle.finance/pendle-v2/ProtocolMechanics/YieldTokenization/PT
- GMX liquidity documentation: https://docs.gmx.io/docs/providing-liquidity/
