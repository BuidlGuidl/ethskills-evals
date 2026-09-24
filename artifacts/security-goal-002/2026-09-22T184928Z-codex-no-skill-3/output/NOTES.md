# Fixed-Rate WETH/USDC Borrow Market Notes

## Health computation

- WETH collateral is valued from the configured Chainlink-style ETH/USD oracle. The contract treats USDC as one dollar, so a USDC depeg is not reflected in health.
- Collateral value is reported in USDC base units: `wethAmount * ethUsdPrice / 1e18`, then converted from oracle decimals to USDC's 6 decimals.
- A borrower may borrow or withdraw only if their post-action debt is at most 70% of collateral value.
- Debt accrues simple interest per position at the immutable annual rate set in the constructor: `debt * annualInterestBps * elapsed / (10000 * 365 days)`. It is accrued on writes and previewed in views.
- A position is liquidatable when its current debt is greater than 85% of collateral value. Equality is not liquidatable.

## Liquidator flow

1. Check `positionHealth(borrower)` and confirm `liquidatable == true`.
2. Choose a USDC repayment amount. `liquidationSeizeAmount(repayUsdc)` previews the WETH that will be seized.
3. Approve the market to spend USDC, then call `liquidate(borrower, repayUsdc)`.
4. The contract pulls the USDC, reduces the borrower's debt, and transfers WETH worth the repaid debt plus a 5% bonus.

If the selected repayment would require more WETH than remains in the position, liquidation reverts with `InsufficientCollateral`; use a smaller repay amount.

## Mainnet deployment checklist

- Use the canonical mainnet WETH and USDC contracts and verify both addresses independently before deployment.
- Use the intended ETH/USD oracle, verify its decimals, and set a stale-price window that matches the feed heartbeat and operational risk tolerance.
- Set the annual interest rate carefully. It is immutable in this implementation, so changing it requires a new deployment and migration plan.
- Fund the market with enough USDC before opening borrowing. The contract has no external lender accounting; liquidity is operator-managed.
- Keep the owner key highly secured, preferably behind a multisig/timelock. The owner can pause deposits, borrows, and borrower withdrawals; repayments and liquidations remain available.
- Monitor oracle freshness, USDC liquidity, total debt, and large positions. Liquidations depend on third parties calling the contract when prices move.
- This implementation assumes USDC remains worth one dollar. A production market should consider a USDC/USD oracle, reserves, caps, and emergency procedures for stablecoin or oracle failures.
