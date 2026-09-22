# Flash-Loan Arbitrage Design

This document models one Ethereum mainnet execution that borrows 100,000 USDC from Aave V3, trades through two DEX pools, repays Aave, and keeps any remaining USDC.

Sources checked on 2026-09-22:

- Aave V3 flash loans execute atomically: the receiver gets the borrowed reserve, performs its operation, approves repayment, and Aave pulls `amount + premium` before the transaction ends. Aave docs also state the flash-loan fee is initialized at 0.05% and can be updated by governance, so production code must read `FLASHLOAN_PREMIUM_TOTAL` from the Pool before relying on this number: https://docs-aave.vercel.app/docs/aave-v3/guides/flash-loans
- Uniswap V3-style pools can use a 0.05% fee tier, and swap fees are charged from the swap input amount. This design uses two 0.05% DEX pools as the baseline: https://support.uniswap.org/hc/en-us/articles/20901935681677-What-is-a-liquidity-provider-LP-fee

## Baseline Assumptions

These numbers are for the first design pass. The bot must recompute them from live quotes before every transaction.

| Item | Value |
| --- | ---: |
| Flash-loan asset | USDC |
| Flash-loan principal | 100,000.00 USDC |
| Aave V3 flash-loan premium | 0.05% |
| DEX A swap fee | 0.05% |
| DEX B swap fee | 0.05% |
| Estimated gas used | 650,000 gas |
| Effective gas price | 20 gwei |
| ETH/USD used for costing | $3,500 |
| Private relay / builder tip | $0 baseline, included in gas if used |

The route is represented as:

```text
USDC -> intermediate asset on DEX A -> USDC on DEX B
```

For the arithmetic below, the intermediate asset can be WETH, USDT, DAI, or another liquid asset. The important invariant is that the final asset is USDC so Aave can be repaid in the borrowed asset.

## Single Execution Sequence

1. Keeper or searcher calls the arbitrage contract with a route and minimum-profit guard.

   Amount in the contract before the flash loan: `0 USDC`.

2. Contract calls Aave V3 Pool using `flashLoanSimple(USDC, 100,000 USDC, params)`.

   Aave sends `100,000.00 USDC` to the receiver contract.

3. Receiver executes the first swap on DEX A.

   Input: `100,000.00 USDC`

   DEX A fee at 0.05%: `100,000.00 * 0.0005 = 50.00 USDC`

   Net value entering the pool curve: `99,950.00 USDC`

   Output: intermediate asset, valued at the live DEX A quote after pool price impact.

4. Receiver executes the second swap on DEX B.

   Input: the full intermediate-asset balance from step 3.

   DEX B fee at 0.05%, approximated on a 100,000 USD trade: `100,000.00 * 0.0005 = 50.00 USD`

   Output: USDC from DEX B.

   Let `G` be the gross cross-DEX price gap in USD on the 100,000 USDC trade, measured before Aave premium, gas, and DEX swap fees. Then the final USDC balance before repayment is approximately:

   ```text
   100,000.00 + G - 50.00 - 50.00
   = 99,900.00 + G USDC
   ```

5. Receiver approves Aave Pool to pull principal plus flash-loan premium.

   Aave premium: `100,000.00 * 0.0005 = 50.00 USDC`

   Amount owed to Aave: `100,000.00 + 50.00 = 100,050.00 USDC`

6. Aave pulls `100,050.00 USDC` from the receiver.

   If the receiver has less than `100,050.00 USDC`, the whole transaction reverts. The swaps and loan are undone, but the transaction still burns gas.

7. Remaining USDC is profit.

   ```text
   Profit before gas = final USDC before repayment - 100,050.00
                     = (99,900.00 + G) - 100,050.00
                     = G - 150.00
   ```

8. Transaction gas is paid by the caller/searcher wallet in ETH.

   Baseline gas cost:

   ```text
   650,000 gas * 20 gwei = 13,000,000 gwei
   13,000,000 gwei / 1,000,000,000 = 0.013 ETH
   0.013 ETH * $3,500/ETH = $45.50
   ```

   Profit after gas:

   ```text
   Net profit = G - 150.00 - 45.50
              = G - 195.50
   ```

## Cost Itemization

| Cost | Formula | Baseline Cost |
| --- | ---: | ---: |
| Aave V3 flash-loan premium | `100,000 * 0.05%` | `$50.00` |
| DEX A swap fee | `100,000 * 0.05%` | `$50.00` |
| DEX B swap fee | `~100,000 * 0.05%` | `$50.00` |
| Ethereum gas | `650,000 * 20 gwei * $3,500/ETH` | `$45.50` |
| Private relay / builder tip | assumed included in gas | `$0.00` |
| Pool price impact / adverse slippage | included in live DEX quotes; subtract separately if `G` is measured from mid-prices | `$0.00 extra in this model` |
| One-time deployment | not paid per execution | `$0.00 per run` |
| One-time token approvals | avoided by approving inside flash-loan callback only for owed amount | `$0.00 extra per run` |

Baseline per-execution cost:

```text
$50.00 + $50.00 + $50.00 + $45.50 + $0.00
= $195.50
```

## Minimum Price Gap

Under the baseline assumptions, the trade loses money if the gross cross-DEX price gap on the 100,000 USDC trade is less than `$195.50`.

Break-even arithmetic:

```text
Required gap = Aave premium + DEX A fee + DEX B fee + gas + relay tip + extra slippage
             = $50.00 + $50.00 + $50.00 + $45.50 + $0.00 + $0.00
             = $195.50
```

As a percentage of the 100,000 USDC trade:

```text
$195.50 / $100,000.00 = 0.001955 = 0.1955%
```

Execution rule:

```text
Only execute when quoted gross gap > $195.50 + desired profit buffer.
```

For example, with a `$100.00` minimum profit buffer:

```text
Required gap = $195.50 + $100.00 = $295.50
Required percentage gap = $295.50 / $100,000.00 = 0.2955%
```

## Runtime Checks

Before submitting a transaction, the bot must refresh:

- Aave `FLASHLOAN_PREMIUM_TOTAL`.
- USDC reserve status and available liquidity on Aave V3 Ethereum.
- DEX pool fees, reserves/liquidity, price impact, and exact quoted output for both swaps.
- Current gas estimate, base fee, priority fee, any builder tip, and ETH/USD.
- Minimum amount out for both swaps so stale quotes revert instead of repaying an unprofitable loan.
- Final invariant: `expectedFinalUSDC >= 100,050.00 USDC + gasInUSDC + minimumProfitUSDC`.

The transaction should be simulated on a mainnet fork immediately before broadcast. A revert is preferable to a successful transaction that repays Aave and leaves less USDC than the gas-adjusted minimum profit.
