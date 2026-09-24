# WETH/USDC Borrow Market Notes

## Position health

Collateral is WETH and debt is USDC. The market reads an ETH/USD Chainlink-style oracle and converts WETH collateral into 6-decimal USDC value:

```text
collateral_value_usdc = collateral_weth * eth_usd_price / oracle_unit / 1e12
```

Borrowing and collateral withdrawals require the position to stay within the borrow cap:

```text
debt_usdc <= collateral_value_usdc * 70%
```

Debt accrues simple, linear interest whenever the position is touched:

```text
new_debt = old_debt + old_debt * annual_interest_bps * elapsed_seconds / 10_000 / 365 days
```

A position is liquidatable only after its current debt exceeds the liquidation threshold:

```text
debt_usdc > collateral_value_usdc * 85%
```

This means there is a buffer between the 70% borrow limit and the 85% liquidation threshold. The contract also applies the 70% cap after withdrawals, so a borrower cannot withdraw collateral into the liquidation buffer.

## Liquidator flow

1. Find a borrower where `isLiquidatable(borrower)` is true.
2. Approve the market to spend USDC.
3. Call `liquidate(borrower, maxRepayUsdc)`.
4. The market accrues the borrower's interest, verifies the position is above 85% LTV, pulls the actual USDC repayment from the liquidator, and transfers WETH collateral to the liquidator.

The WETH seized is worth the USDC repaid plus a 5% bonus at the current oracle price. If `maxRepayUsdc` is larger than the remaining debt or larger than what the borrower's collateral can cover, the contract caps the actual repayment and only pulls that capped amount.

## Mainnet deployment checklist

- Use canonical Ethereum mainnet assets: WETH has 18 decimals and USDC has 6 decimals. The contract is intentionally written for those units.
- Use the ETH/USD Chainlink feed, verify its address from Chainlink's official feed registry/docs, and set a conservative `maxPriceAge` for stale-price protection.
- Choose the fixed `annualInterestBps` before deploy. It is immutable in this version.
- Fund the market with enough USDC using `supplyLiquidity`; borrowers can only draw USDC already held by the contract.
- Seed the owner as a multisig or controlled operations address. The owner can supply and withdraw USDC liquidity but cannot withdraw borrower WETH collateral.
- Monitor oracle freshness, USDC liquidity, bad-debt risk, and positions near the 85% threshold.
- Make sure frontend/indexer displays accrued debt, not only stored debt, by using `debtOf`, `ltvBps`, and `borrowableUsdc`.
- This is intentionally small and does not include governance, pausing, reserve accounting, protocol fees, multi-collateral support, or oracle fallback logic. Those are mainnet risk decisions, not UI details.

