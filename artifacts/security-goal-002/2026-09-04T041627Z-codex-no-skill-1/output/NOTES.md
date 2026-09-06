# Borrowing Market Notes

## Health computation

Each position tracks:

- WETH collateral, in `18` decimals.
- USDC debt, in `6` decimals.

The market reads an ETH/USD price from an `AggregatorV3Interface` oracle with `8`
decimals, which matches the standard mainnet Chainlink ETH/USD feed.

Collateral value in USDC base units is computed as:

`collateralValue = collateralWeth * ethUsdPrice / 1e20`

That scale conversion comes from:

- `1e18` for WETH decimals
- `1e8` for the oracle
- `1e6` for USDC

Borrow health has two thresholds:

- Borrow cap: debt must stay at or below `70%` of collateral value to borrow.
- Liquidation threshold: the position becomes liquidatable once debt is above `85%` of collateral value.

Interest accrues linearly over time through a global borrow index:

- `borrowIndex(t) = borrowIndex(t-1) * (1 + annualRate * dt / 365 days)`
- A user’s live debt is `debtPrincipal * borrowIndex / 1e27`

Withdrawals are allowed only if the remaining position stays at or below the
`85%` liquidation threshold after the collateral is removed.

## Liquidation flow

A liquidator must:

1. Check that the target position is above the `85%` liquidation threshold.
2. Approve USDC to the market contract.
3. Call `liquidate(account, maxRepayAmount)`.

The market repays up to the requested amount, capped so the liquidator never
tries to seize more WETH than the position holds. The seized collateral is:

`seizedWeth = debtValueInWeth * 1.05`

So the liquidator receives the WETH equivalent of the repaid USDC plus a `5%`
bonus.

The implementation supports partial liquidations. A liquidator does not need to
clear the full debt.

## Mainnet deployment and operations

An operator needs to get the following right:

1. Use the canonical token and oracle addresses for Ethereum mainnet:
   - WETH with `18` decimals
   - USDC with `6` decimals
   - Chainlink ETH/USD oracle with `8` decimals
2. Choose a flat annual interest rate in basis points when deploying the
   contract constructor.
3. Fund the contract with enough USDC using `addLiquidity` before borrowers try
   to draw loans.
4. Keep enough idle USDC in the contract if the intent is to support new
   borrowing at all times. Existing positions can still repay without that
   liquidity, but new borrows will fail if the contract balance is short.
5. Monitor oracle freshness. The contract rejects prices older than `2 hours`,
   so a stale oracle pauses borrow, withdraw, and liquidation. Plain repayment
   does not depend on the oracle.
6. Treat `removeLiquidity` as a privileged action with operational discipline.
   The contract allows the owner to pull idle USDC, so deployment should put
   ownership behind an appropriate mainnet control plane such as a multisig.
