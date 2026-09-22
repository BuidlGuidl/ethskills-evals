# Flash-Loan Arbitrage Design

This design describes one successful Ethereum mainnet execution for a bot that borrows `100,000 USDC` from Aave V3, swaps through two DEXes, repays the loan, and keeps the remaining profit.

## Assumptions

- Chain: Ethereum mainnet.
- Borrow asset: USDC, treated as `$1.00`.
- Flash-loan source: Aave V3 `flashLoanSimple()` for a single reserve.
- Flash-loan amount: `100,000 USDC`.
- Aave V3 flash-loan premium: `0.05%` / `5 bps`.
  - Aave documents the V3 flash-loan fee as initialized to `0.05%` and says bots should read `FLASHLOAN_PREMIUM_TOTAL` for the current value because governance can update it.
- Trade route: USDC -> WETH on DEX A, then WETH -> USDC on DEX B.
- DEX fee baseline: `0.05%` / `5 bps` on each swap leg.
- Gas baseline: `500,000 gas`.
- Effective gas price baseline: `5 gwei`, including base fee and priority fee.
- ETH/USD reference: `$2,731.37`.
- No separate private relay fee or block-builder bribe in the baseline. If used, add it directly to the gas/MEV cost line.

The bot must replace the Aave premium, DEX fee tiers, gas estimate, effective gas price, and ETH/USD price with live values before deciding whether to submit a transaction.

## Single Execution Flow

1. The keeper finds a candidate route where DEX B sells WETH for more USDC than DEX A charges to buy WETH.

2. The keeper calls the arbitrage contract with:
   - `borrowAmount = 100,000 USDC`
   - `asset = USDC`
   - `route = [DEX A USDC/WETH, DEX B WETH/USDC]`
   - `minFinalUsdc`, set high enough to cover repayment, gas, and desired profit.

3. The contract calls Aave V3 Pool using `flashLoanSimple()`.
   - USDC leaving Aave Pool: `100,000 USDC`
   - USDC received by arbitrage contract: `100,000 USDC`
   - Aave premium accrued: `100,000 * 0.0005 = 50 USDC`
   - Amount owed at the end of the transaction: `100,000 + 50 = 100,050 USDC`

4. The contract swaps the borrowed USDC on DEX A.
   - USDC sent into DEX A: `100,000 USDC`
   - DEX A fee at `0.05%`: `100,000 * 0.0005 = 50 USDC`
   - USDC value actually exposed to the DEX A price: `99,950 USDC`
   - WETH received: `99,950 / buyPrice` WETH, before pool price impact rounding.

5. The contract swaps all received WETH on DEX B.
   - WETH sent into DEX B: all WETH received from DEX A.
   - DEX B fee at `0.05%`: charged on the WETH input.
   - USDC received: depends on DEX B sell price, DEX B fee, and pool price impact.
   - At exact break-even under the baseline assumptions, USDC received after both DEX fees must be `100,056.83 USDC`.

6. The contract checks profitability before approving repayment.
   - Required Aave repayment: `100,050 USDC`
   - Required gas recovery: `$6.83` economic value
   - Required final balance for zero net profit: `100,056.83 USDC`
   - For a positive profit target, require `100,056.83 + targetProfitUsd` USDC.

7. The contract approves the Aave Pool to pull the repayment amount.
   - Approval amount: `100,050 USDC`

8. Aave pulls the repayment at the end of `executeOperation()`.
   - USDC pulled by Aave: `100,050 USDC`
   - Remaining USDC at exact economic break-even: `6.83 USDC`
   - ETH gas paid by transaction sender: `$6.83`
   - Net economic result at break-even: `$0.00`

If any step cannot satisfy `minFinalUsdc`, the transaction should revert. A reverted transaction does not leave the flash loan or swaps executed, but the sender still pays gas consumed before the revert.

## Cost Items

Baseline successful execution costs:

| Cost item | Formula | Amount |
| --- | ---: | ---: |
| Aave V3 flash-loan premium | `100,000 * 0.05%` | `$50.00` |
| DEX A LP fee, direct token amount | `100,000 * 0.05%` | `50.00 USDC` |
| DEX A LP fee, break-even economic value | `50 * rawPriceRatio` | `$50.08` |
| DEX B LP fee, break-even economic value | `100,106.88 * 0.05%` | `$50.05` |
| Gas | `500,000 * 5 gwei = 0.0025 ETH`; `0.0025 * $2,731.37` | `$6.83` |
| Private relay / builder bribe | baseline assumes none | `$0.00` |
| Deployment cost | not paid per execution | `$0.00` |
| USDC transfer fee | USDC has no token transfer fee | `$0.00` |

Total break-even economic cost expressed as raw pre-fee price gap:

```text
$50.00 Aave premium
+$50.08 DEX A fee opportunity cost
+$50.05 DEX B fee
+ $6.83 gas
= $156.96
```

## Minimum Price Gap

There are two useful ways to express the break-even threshold.

### If the quote engine reports final USDC after DEX fees

The bot loses money unless:

```text
finalUsdcOut >= borrowedPrincipal + AavePremium + gasUsd
finalUsdcOut >= 100,000 + 50 + 6.83
finalUsdcOut >= 100,056.83 USDC
```

So the after-DEX-fee route surplus must be at least:

```text
100,056.83 - 100,000 = $56.83
```

Any final DEX quote below `100,056.83 USDC` loses money under the baseline.

### If measuring the raw venue price gap before DEX fees

Let:

```text
principal = 100,000
aavePremium = 50
gasUsd = 6.83
dexAFee = 0.0005
dexBFee = 0.0005
rawGap = the pre-DEX-fee price gap in USD on the 100k trade
```

Break-even requires:

```text
(principal + rawGap) * (1 - dexAFee) * (1 - dexBFee)
  >= principal + aavePremium + gasUsd

(100,000 + rawGap) * 0.9995 * 0.9995
  >= 100,000 + 50 + 6.83

(100,000 + rawGap) * 0.99900025
  >= 100,056.83

100,000 + rawGap
  >= 100,056.83 / 0.99900025

100,000 + rawGap
  >= 100,156.96

rawGap
  >= $156.96
```

Therefore the raw cross-DEX price gap must be at least:

```text
$156.96 on a $100,000 trade
= 0.15696%
= 15.696 bps
```

Any raw price gap below about `$157` on the `100,000 USDC` trade loses money under the baseline assumptions. In production the bot should require a safety margin above this threshold for quote staleness, pool price impact, rounding, reverts, and MEV risk.

## Runtime Guard

Before submitting a transaction, the keeper should compute:

```text
requiredFinalUsdc =
  borrowAmount
  + borrowAmount * currentAaveFlashLoanPremium
  + estimatedGasUnits * maxFeePerGasEth * ethUsd
  + targetProfitUsd
  + optionalBuilderPaymentUsd
```

The submitted transaction should pass `requiredFinalUsdc` as `minFinalUsdc`. The contract should revert unless the actual final USDC balance is at least that value before Aave repayment.

## References

- Aave V3 flash-loan documentation: https://docs-aave.vercel.app/docs/aave-v3/guides/flash-loans
- ETH/USD reference used for this baseline: https://metamask.io/price/ethereum
