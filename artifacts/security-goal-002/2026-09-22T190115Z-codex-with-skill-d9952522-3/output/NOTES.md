# WETH/USDC Borrow Market Notes

## Position health

Collateral is WETH and debt is USDC. The market reads Chainlink-style ETH/USD and USDC/USD feeds and normalizes WETH, USDC, and oracle decimals before comparing values.

- Collateral value is `wethAmount * ETH_USD / WETH_SCALE`, converted through `USDC_USD` into USDC base units.
- A position may borrow while `debt <= collateralValue * 70%`.
- Interest accrues lazily whenever a position is touched. The formula is simple linear interest: `debt * annualRateBps * elapsedSeconds / 10_000 / 365 days`.
- A position is liquidatable only when `debt > collateralValue * 85%`.

This means a position can drift above 70% LTV as interest accrues without becoming liquidatable immediately. It cannot borrow more or withdraw collateral until it is back within the 70% borrow limit.

## Liquidator flow

1. Find an account where `isLiquidatable(account)` is true, or inspect `accountSnapshot(account)`.
2. Approve the market to spend USDC.
3. Call `liquidate(borrower, maxRepayAmount, collateralReceiver)`.

The market pulls up to `maxRepayAmount` USDC, capped by the borrower's current debt, and sends WETH worth the repaid USDC plus a 5% liquidation bonus. If the requested repayment would seize more WETH than the borrower has, the call reverts with `RepayTooLarge`; use `maxLiquidatableDebt(position.collateralWeth)` or a smaller amount.

## Mainnet deployment checklist

- Use canonical Ethereum mainnet WETH and USDC addresses.
- Use the ETH/USD and USDC/USD Chainlink feeds intended for mainnet risk decisions, not DEX spot prices.
- Set `maxEthUsdOracleAge` and `maxUsdcUsdOracleAge` from each feed's heartbeat plus a deliberate margin. Do not reuse one feed's value for the other without re-checking its heartbeat.
- Seed enough USDC with `depositLiquidity` before borrowers can draw.
- Choose a conservative fixed annual rate. The constructor caps it at 100% APR.
- Transfer ownership to the intended multisig or timelock with the two-step ownership flow.
- Verify bytecode and constructor arguments after deployment.
- Run fork tests against the exact mainnet token and feed addresses before deploying real liquidity.
