# Two-Tranche Yield Vault Design

Snapshot date: 2026-09-22. Target chain: Arbitrum One.

## Summary

The vault exposes two independent deposit choices rather than making one pool senior to the other.

| Tranche | User promise | Deployment | Primary yield source |
| --- | --- | --- | --- |
| A | Fixed rate locked at deposit, paid at a known maturity | Pendle V2 PT market on Arbitrum, starting with PT-USDai maturing 2026-10-15 | PT purchased below its maturity redemption value |
| B | Variable fee yield with higher downside risk | GMX V2 GLV/GM liquidity on Arbitrum, starting with GLV [ETH-USDC] | Fees and trader PnL flowing into GMX liquidity pools |

Default deposit asset should be USDC. Internally, Tranche A routes USDC into the selected Pendle accounting asset before buying PT. The clean fixed promise is therefore in the Pendle accounting asset, not pure USDC, unless the vault explicitly accepts and reserves for USDai/USDC conversion risk at maturity.

## Live Protocol Evidence

- Pendle V2 supports Arbitrum as chain ID `42161`, and its API exposes market fields including `chainId`, `address`, `expiry`, and `impliedApy`.
  Sources: https://docs.pendle.finance/pendle-v2-dev/Deployments and https://docs.pendle.finance/cn/pendle-v2-dev/Quickstart
- Pendle PTs redeem 1:1 for the accounting asset at maturity and earn fixed yield because PT is bought at a discount that converges to redemption value.
  Sources: https://docs.pendle.finance/pendle-v2/ProtocolMechanics/YieldTokenization/PT and https://docs.pendle.finance/pendle-academy/optimizing-yields-with-pendle/chapter-3.1-fixed-yield-on-pendle
- On 2026-09-22, the Pendle market API showed four active Arbitrum markets after filtering for `chainId == 42161` and expiry after 2026-09-22. The deepest was USDai, market `0xa8a0dea40174cfc30fea9e3a77f182ab33f46e25`, maturing 2026-10-15, with about $50.3m liquidity and a 9.68% implied APY at query time.
  Source: `https://api-v2.pendle.finance/core/v2/markets/all?limit=100&skip=0`
- GMX V2 liquidity pools back leverage trading and swaps. GMX docs state that liquidity providers earn 63% of fees from trading, liquidations, borrow fees, and swaps on Arbitrum and Avalanche.
  Source: https://docs.gmx.io/docs/providing-liquidity/
- GMX provides Arbitrum liquidity APY endpoints for GM pools and GLV vaults.
  Source: https://docs.gmx.io/docs/api/rest-api/liquidity/
- On 2026-09-22, the GMX Arbitrum APY endpoint returned GLV [ETH-USDC] at `0x528A5bac7E746C9A509A1f4F6dF58A03d44279F9` with about 8.90% APY and GLV [WBTC.b-USDC] at `0xdF03EEd325b82bC1d4Db8b49c30ecc9E05104b96` with about 10.63% APY at query time.
  Source: `https://arbitrum-api.gmxinfra.io/apy`

## Tranche A: Fixed Maturity Tranche

Protocol: Pendle V2 on Arbitrum.

Initial market: PT-USDai, Pendle market `0xa8a0dea40174cfc30fea9e3a77f182ab33f46e25`, maturity 2026-10-15. This should be treated as a launch parameter, not a permanent constant. New vault terms should select a live Pendle market with sufficient liquidity, maturity, and an acceptable underlying risk profile.

Deposit flow:

1. User deposits USDC and chooses Tranche A.
2. Vault quotes Pendle Router for USDC -> PT-USDai.
3. Vault records the exact fixed maturity value owed to the user:
   - `ptReceived`
   - `maturity`
   - `accountingAsset`
   - implied fixed rate at deposit time
   - minimum output and slippage used
4. Vault holds PT until maturity.
5. At or after maturity, keeper redeems PT for USDai.
6. Vault pays the user in USDai by default, or swaps to USDC if the product promises USDC settlement.

How it earns:

PT is bought at a discount to the accounting asset. If the vault holds to maturity and Pendle plus the underlying asset behave correctly, each PT redeems for one unit of the accounting asset. The spread between the discounted purchase price and maturity redemption value is the user's fixed return.

Keeper behavior:

- Before maturity, the keeper mainly handles idle USDC deployment, slippage-checked swaps, accounting snapshots, and health monitoring.
- At maturity, the keeper redeems matured PT and either pays claims or rolls unclaimed proceeds into the next approved Pendle market.
- There is no true intra-term compounding for PT principal. The fixed yield is realized through pull-to-par. "Compounding" for Tranche A means rolling matured proceeds into a new PT term.

Risks:

- Pendle smart contract and router risk.
- USD.AI/USDai underlying risk, including credit, collateral, oracle, redemption, and stable-asset depeg risk.
- USDC-to-USDai and USDai-to-USDC conversion risk if the UI or vault promises USDC-denominated returns.
- Early exit risk: if the vault supports withdrawals before maturity, PT must be sold at the current market price, which can be below the deposit-time value after slippage.
- Liquidity risk in the selected Pendle market, especially near maturity or during stress.
- Rollover risk: future Pendle markets may not offer comparable fixed rates or adequate liquidity.
- Operational keeper risk around maturity redemption and term rollover.

## Tranche B: Trader-Fee Tranche

Protocol: GMX V2 on Arbitrum.

Initial pool: GLV [ETH-USDC], token `0x528A5bac7E746C9A509A1f4F6dF58A03d44279F9`. This gives broad GMX liquidity exposure across supported ETH-USDC-backed GM markets and auto-shifts liquidity according to GMX/Chaos Labs configured market support. A later version may add capped WBTC.b-USDC GLV exposure after separate limits and monitoring.

Deposit flow:

1. User deposits USDC and chooses Tranche B.
2. Vault routes into the GLV buy flow, pairing or swapping into the needed long/short assets when required.
3. Vault mints or buys GLV/GM tokens with strict price-impact and slippage limits.
4. Vault shares represent a pro rata claim on the held GMX liquidity tokens.
5. Withdrawals sell GLV/GM tokens back through GMX, subject to liquidity, reserved amounts, caps, price impact, and market status.

How it earns:

GMX liquidity providers are the counterparty and liquidity source for leveraged traders and swaps. Fees from trading, swaps, borrowing, and liquidations flow into the pools, increasing GM/GLV token value over time. There is no separate fee claim needed for the core fee stream; holding the liquidity token captures it through price appreciation.

Keeper behavior:

- Deploy idle USDC into GLV/GM when deposits accumulate.
- Reinvest any external incentives or dust balances, if applicable.
- Monitor GLV/GM APY, utilization, pool caps, reserve usage, disabled-market flags, and withdrawal liquidity.
- Pause new Tranche B deposits if GMX disables deposits, if price impact is too high, or if pool utilization/imbalance breaches policy limits.
- Optionally rebalance between GLV [ETH-USDC] and approved GM pools when the live risk-adjusted fee opportunity changes.

Risks:

- GMX smart contract risk.
- Counterparty risk to leveraged traders: when traders profit, the value comes from the liquidity pool.
- Market exposure: GLV [ETH-USDC] behaves partly like a rebalanced ETH/USDC portfolio plus trader-fee and trader-PnL effects, not like a stablecoin deposit.
- Open interest imbalance, funding, borrow-rate, and liquidation dynamics can hurt LP value.
- Liquidity and redemption risk: withdrawals can be delayed or expensive when pool liquidity is reserved, caps are hit, or GMX disables deposits/withdrawals for a market.
- Price impact risk on deposits and withdrawals, especially for large vault flows.
- GLV allocation risk: GLV can shift liquidity among supported GM markets; the supported set can change.
- Oracle and execution risk in GMX's two-phase order flow.
- USDC bridge/token risk on Arbitrum.

## Cross-Tranche Accounting

Tranche A and Tranche B should not share assets or losses by default. Each deposit mints tranche-specific shares backed only by that tranche's positions.

Tranche A accounting is liability-based: the vault records fixed maturity claims and must reserve enough PT/matured accounting asset to satisfy them.

Tranche B accounting is NAV-based: shares track the current value of GMX liquidity tokens after estimated exit costs.

If the product later wants a true senior/junior structure where Tranche B backstops Tranche A, that should be a separate design. It would require explicit loss waterfalls, reserve ratios, junior capital minimums, and rules for what happens when GMX losses exceed B's buffer.

## Launch Guards

- Only open a new Tranche A term if the selected Pendle market has enough liquidity for expected deposits and exits.
- Lock deposit-time terms using actual PT received, not a stale displayed APY.
- Cap per-market and per-protocol exposure.
- Enforce min-out checks on every route.
- Mark Tranche A settlement currency clearly: USDai-denominated is cleaner; USDC-denominated needs an explicit conversion buffer.
- Mark Tranche B as variable and principal-at-risk.
- Add emergency pause controls for new deposits, not unilateral seizure or arbitrary withdrawal blocking.
- Run fork tests for deposit, redeem, early exit, GMX buy/sell, disabled-market handling, slippage failure, and keeper failure at maturity.
