# Two-Tranche Yield Vault Design

## Scope and assumptions

This vault runs on Arbitrum and accepts a single accounting asset, assumed to be USDC unless a later implementation chooses another stablecoin. Users choose one tranche at deposit time:

- **Tranche A:** fixed-rate, fixed-maturity exposure quoted at deposit time.
- **Tranche B:** variable, higher-risk exposure to fees paid by leveraged traders.

Each deposit is recorded as a lot with its own tranche, deposit amount, promised maturity, and rate or share price. This matters because tranche A rates change over time; deposits made on different days cannot be treated as identical fixed-rate claims unless they were quoted into the same maturity at the same effective rate.

## Protocol allocation

### Tranche A: Pendle Principal Tokens

Tranche A deploys into whitelisted Pendle PT markets on Arbitrum. For each supported maturity, the vault buys a Pendle Principal Token for a yield-bearing stablecoin or blue-chip accounting asset. The default implementation should start with one conservative stablecoin-denominated market per maturity, selected by governance from live Pendle Arbitrum markets.

The vault should only support a Pendle market when all of the following are true:

- The market is deployed on Arbitrum.
- The PT accounting asset matches the vault accounting asset, or the conversion path is explicitly whitelisted.
- The maturity date is known and can be mapped to user lots.
- Market liquidity is deep enough to quote deposits and early exits with bounded slippage.
- The underlying yield-bearing asset and its protocol are approved by governance.

Pendle is the right primitive for tranche A because PTs are zero-coupon-style claims: they are bought at a discount and become redeemable for the accounting asset at maturity. The fixed return is the difference between the purchase price and the redemption value, less vault fees and execution costs.

### Tranche B: GMX V2 GM or GLV liquidity

Tranche B deploys into GMX V2 liquidity on Arbitrum, using either:

- **GM tokens** for specific risk-isolated markets, such as ETH/USD backed by WETH-USDC.
- **GLV tokens** if the vault wants automatic allocation across a governance-approved set of GMX markets.

The initial recommendation is to use a small whitelist of deep, fully backed GMX markets before allowing synthetic or long-tail markets. Tranche B is intended to earn the fee stream from leveraged trading, so it should avoid GMX markets labeled swap-only or spot-only.

## How positions earn

### Tranche A earnings

When a user deposits into tranche A:

1. The vault quotes the live Pendle implied fixed rate for a chosen maturity.
2. The vault swaps or routes the deposit asset into the required input asset.
3. The vault buys enough PT to satisfy the promised maturity payout.
4. The user's lot stores the deposit amount, maturity, fixed rate, PT amount, and expected payout.

The position earns because the PT is purchased below its maturity redemption value. No variable yield is owed to tranche A after purchase; variable yield and points belong to the corresponding YT side of the Pendle market, not the PT holder.

At maturity:

1. The keeper redeems PT through Pendle.
2. The vault pays the user's fixed claim.
3. Any remaining surplus after promised payout, fees, and rounding can be routed according to governance policy, preferably to the protocol reserve rather than tranche B unless the product explicitly sells A/B risk sharing.

Before maturity, an early exit should be optional and priced at the current PT market value. It should not receive the original promised maturity payout.

### Tranche B earnings

When a user deposits into tranche B:

1. The vault routes the deposit into the tokens needed to mint or buy GMX liquidity.
2. The vault receives GM or GLV tokens.
3. The user's claim is tracked as shares of the tranche B pool.

GMX liquidity backs leverage trading and swaps. Fees from trading, borrowing, swaps, and liquidations increase pool value. For GM tokens, the token price reflects pool assets plus aggregate pending trader PnL divided by supply, so tranche B earns when fee income and favorable trader PnL outweigh losses, rebalancing costs, and price movement in the backing assets.

Tranche B should use share accounting, not promised APY accounting. Depositors receive the current tranche B share price on entry and exit at the then-current share price, after any withdrawal fees, execution costs, and slippage.

## Keeper behavior

The keeper has separate responsibilities for each tranche:

- **Tranche A:** deploy idle assets into the selected Pendle PT, redeem matured PT, settle user lots, and roll protocol-owned residual balances into the next approved maturity when configured.
- **Tranche B:** compound any external rewards if present, reinvest idle balances, rebalance across whitelisted GMX markets, and avoid deposits when GMX market caps, price impact, or liquidity constraints exceed policy limits.

For tranche A, there is usually no intra-term yield stream to harvest. The fixed return is embedded in PT discount accretion, so the keeper's main job is execution, settlement, and rollover. For tranche B, GMX fee income is mostly reflected in the GM or GLV token price, so compounding may also be a no-op unless there are separate incentives or idle balances to reinvest.

## Risk profile

### Tranche A risks

- **Underlying asset risk:** PT redemption is denominated in the Pendle market's accounting asset and depends on the underlying yield-bearing asset and its wrapper working correctly.
- **Protocol risk:** Pendle, the underlying yield protocol, token wrappers, routers, and approved swap venues can have smart contract or governance failures.
- **Liquidity risk:** Early exits depend on live Pendle market liquidity and may realize losses even if maturity redemption would have paid the fixed claim.
- **Maturity mismatch risk:** A deposit quoted into one maturity cannot be safely paid from a different maturity without explicit roll or unwind logic.
- **Execution risk:** Slippage, stale quotes, oracle issues, and failed keeper transactions can make the acquired PT amount insufficient for the promised payout.
- **Stablecoin risk:** If the accounting asset depegs or is frozen, the fixed-rate promise may be technically honored but economically impaired.
- **No upside risk:** Tranche A gives up variable yield, points, and rewards generated by the underlying yield-bearing asset.

### Tranche B risks

- **Trader PnL risk:** GMX liquidity providers are the counterparty to trader profits and losses. A period of profitable traders can reduce GM or GLV value.
- **Market exposure risk:** Multi-token GM pools expose tranche B to the backing assets, such as WETH and USDC. A vault that accepts USDC can still gain ETH price exposure after entering a WETH-USDC market.
- **Synthetic market risk:** Synthetic GMX markets can have payout exposure where the index asset differs from the backing asset. These should be disabled initially unless explicitly approved.
- **Liquidity and cap risk:** GMX deposits and withdrawals can be limited by pool caps, open interest, reserve factors, price impact, or disabled deposit settings.
- **Oracle and execution risk:** GMX relies on oracle-based pricing and keeper-style execution. Delays, bad prices, or adverse execution can affect entry and exit value.
- **Fee variability risk:** Trader activity, borrowing demand, liquidation volume, and governance fee splits can change. Tranche B has no fixed yield.
- **Smart contract and governance risk:** GMX contracts, vault integration code, routers, and governance-controlled parameters can fail or change.

### Shared vault risks

- **Accounting risk:** The vault must isolate tranche A fixed claims from tranche B share claims. Cross-subsidizing losses accidentally would break the product.
- **Keeper risk:** Delayed or malicious keeper behavior can leave assets idle, miss maturity settlement, or rebalance into poor conditions. Critical actions need permissionless fallback paths where practical.
- **Governance risk:** Market whitelists, fee policy, rollover policy, and emergency controls can materially change depositor outcomes.
- **Bridge and chain risk:** Arbitrum sequencer downtime, L1-L2 messaging issues, and bridge assumptions can affect access to funds.

## Open design decisions

- Exact deposit asset: USDC, USDC.e, ETH, or a multi-asset vault.
- Whether tranche A and tranche B are economically independent products or part of one waterfall where tranche B absorbs losses before tranche A.
- Whether tranche B uses GM for explicit market selection or GLV for automated allocation.
- Whether tranche A allows early exits, and if so, whether exits are handled through Pendle market sales or an internal liquidity buffer.
- Fee model for performance fees, management fees, keeper incentives, and surplus after tranche A settlement.

## References

- Pendle PT documentation: https://docs.pendle.finance/pendle-v2/ProtocolMechanics/YieldTokenization/PT
- Pendle Arbitrum deployments: https://docs.pendle.finance/pendle-v2-dev/Deployments
- Pendle maturity and redemption notes: https://docs.openpendle.com/concepts/maturity
- GMX liquidity documentation: https://docs.gmx.io/docs/providing-liquidity/
