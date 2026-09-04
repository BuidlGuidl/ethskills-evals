# WETH / USDC Borrowing Market Notes

## Position health

- Collateral is measured in WETH and valued in USDC using the configured ETH/USD oracle.
- The contract normalizes collateral value into 6-decimal USDC units:
  `collateralValueUsdc = collateralWeth * ethUsdPrice / 1e20`
  when using 18-decimal WETH, 8-decimal ETH/USD price data, and 6-decimal USDC.
- Debt is stored in USDC base units and accrues simple interest over time:
  `debt = principal + principal * annualRateBps * elapsed / (10000 * 365 days)`.
- User-initiated borrowing and collateral withdrawals require:
  `debt <= 70% of collateralValueUsdc`.
- A position becomes liquidatable once:
  `debt > 85% of collateralValueUsdc`.

## Liquidation flow

- Anyone can call `liquidate(user, requestedRepayAmount, receiver)`.
- The liquidator must approve the market contract to pull the USDC being used for the repayment.
- The contract first accrues interest on the target position, checks that the debt is above the 85% threshold, then computes the actual repay amount.
- The repay amount may be lower than the caller requested if the remaining debt is smaller or if the remaining collateral cannot support a larger seizure plus the 5% bonus.
- Collateral seized is:
  `repaidDebt / oraclePrice`, converted into WETH units, then multiplied by `1.05`.
- The liquidator receives seized WETH directly to `receiver`, and the borrower’s debt/collateral balances are reduced in storage.

## Mainnet deployment / operations

- Wire the constructor to canonical mainnet addresses only. The intended production setup is mainnet WETH, mainnet USDC, and a robust ETH/USD oracle such as Chainlink’s ETH/USD feed.
- Set `maxOracleDelay` to a concrete freshness bound that matches the oracle’s update pattern and your monitoring posture. If it is too loose, stale prices can leak risk; if too tight, healthy operations may revert during oracle stalls.
- Prefund the contract with USDC before allowing borrowing. This market has no lender side; it can only lend the USDC balance it already holds.
- Choose the fixed `annualInterestBps` carefully before deployment. In this implementation it is immutable, so changing the rate requires a new market deployment.
- Monitor oracle health, contract USDC liquidity, and positions nearing the 85% liquidation boundary. Liquidations are permissionless; operations should assume third parties will compete for them.
- Verify decimal assumptions before deployment. This implementation assumes 18-decimal WETH and 6-decimal USDC, which is correct for canonical Ethereum mainnet tokens but should not be changed silently for other assets.
