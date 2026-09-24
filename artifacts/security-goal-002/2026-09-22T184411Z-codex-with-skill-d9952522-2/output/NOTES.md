# BorrowingMarket Notes

## Position health

The market is single-collateral and single-debt: WETH collateral, USDC debt. All risk checks convert token amounts into 18-decimal USD values using Chainlink-style WETH/USD and USDC/USD feeds.

- Collateral value: `wethAmount * wethUsdPrice`, normalized for WETH and feed decimals.
- Debt value: current USDC debt plus accrued simple interest, converted with the USDC/USD feed.
- Borrowing limit: debt value must be at or below `70%` of collateral value after every borrow or collateral withdrawal.
- Liquidation threshold: a position becomes liquidatable only when debt value is greater than `85%` of collateral value.
- Health factor returned by `positionOf` is `85% collateral value / debt value`, scaled in basis points. Values above `10000` are above the liquidation line. A zero-debt account returns `type(uint256).max`.

Interest is simple, not compounded continuously. Whenever a borrower borrows, repays, withdraws collateral, or is liquidated, the contract accrues:

```text
newDebt = oldDebt + oldDebt * annualRateBps * elapsed / 10000 / 365 days
```

The accrued amount is rounded down.

## Liquidator flow

1. Check `isLiquidatable(borrower)` or inspect `positionOf(borrower)`.
2. Approve the market to spend the USDC amount to repay.
3. Call `liquidate(borrower, repayAmount)`.
4. The contract accrues the borrower's debt, caps repayment at the current debt, pulls that USDC from the liquidator, and sends WETH collateral worth the repaid USDC value plus a `5%` bonus.

The WETH seizure amount is rounded up. If the requested repayment would require more collateral than the borrower has, liquidation reverts with `InsufficientCollateralForBonus`; the liquidator should retry with a smaller `repayAmount`.

## Mainnet deployment checklist

- Deploy with canonical mainnet WETH and USDC token addresses.
- Use manipulation-resistant Chainlink WETH/USD and USDC/USD feeds. Set each feed's `maxAge` from that feed's published heartbeat plus a deliberate margin, not a generic timeout.
- Confirm token decimals and feed decimals before deployment. The contract rejects decimals above 18.
- Choose the flat `annualRateBps` before deployment; it is immutable and capped at `10000` (`100% APR`).
- Pre-fund USDC liquidity with `depositReserves`, or borrowers will revert when the market cannot transfer USDC out.
- Transfer ownership to the intended multisig or timelock. The owner can withdraw current USDC reserves and recover only excess WETH not recorded as borrower collateral.
- Monitor oracle freshness, market USDC liquidity, liquidation opportunities, and bad-debt risk from fast WETH price moves.
- Verify bytecode after deployment and publish the exact constructor arguments.

