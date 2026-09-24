# Flash-Loan Arbitrage Execution Design

This design covers one Ethereum mainnet execution that borrows 100,000 USDC from
Aave V3, swaps USDC to WETH on one DEX, swaps WETH back to USDC on another DEX,
repays Aave in the same transaction, and keeps the remaining USDC.

## Baseline Assumptions

These numbers make the break-even math concrete. Production code must replace
the mutable values with live reads before each execution.

| Input | Baseline value | Notes |
| --- | ---: | --- |
| Flash-loan principal | 100,000.00 USDC | USDC is treated as $1.00. |
| Aave V3 flash-loan premium | 0.05% / 5 bps | Read `FLASHLOAN_PREMIUM_TOTAL()` from the Aave Pool before trading. |
| DEX A fee tier | 0.05% / 5 bps | Example: low-fee stable/deep pool. |
| DEX B fee tier | 0.30% / 30 bps | Example: standard volatile pool. |
| Gas used | 400,000 gas | Includes Aave call, callback, two swaps, approvals/accounting, and event logs. |
| Gas price | 20 gwei | Use current base fee plus priority fee or private relay bid. |
| ETH price | $3,000.00 | Used only to convert gas to USD. |
| MEV/searcher bribe | $0.00 | If used, add it directly to the cost table. |
| Slippage allowance | $0.00 expected | The transaction must revert if realized output is below `minAmountOut`. |

Gas cost under these assumptions:

```text
400,000 gas * 20 gwei/gas = 8,000,000 gwei = 0.008 ETH
0.008 ETH * $3,000/ETH = $24.00
```

## Single-Execution Sequence

The bot should treat all quotes as atomic: if any step cannot complete with the
required minimum output, the whole transaction reverts and no flash loan remains
open.

| Step | Action | Amount moving |
| --- | --- | ---: |
| 1 | Off-chain searcher finds a cross-DEX opportunity and simulates the exact transaction against the latest block. | No funds move. |
| 2 | Bot contract calls Aave V3 `flashLoanSimple()` for USDC. | Requests 100,000.00 USDC. |
| 3 | Aave transfers principal to the bot contract and calls the receiver callback. | Bot receives 100,000.00 USDC. |
| 4 | Bot swaps all borrowed USDC on DEX A. | Inputs 100,000.00 USDC. |
| 5 | DEX A charges its 0.05% LP fee. | Fee is 50.00 USDC; 99,950.00 USDC value is effectively traded. |
| 6 | Bot receives WETH from DEX A. At the baseline reference price of $3,000/WETH, before price impact beyond the quoted trade. | `99,950 / 3,000 = 33.31666667 WETH`. |
| 7 | Bot swaps the WETH on DEX B back to USDC. The sell-side price must be high enough to cover all costs. | Inputs 33.31666667 WETH. |
| 8 | DEX B charges its 0.30% LP fee. At the break-even price gap calculated below, gross sell proceeds before this fee are 100,375.13 USDC. | Fee is `100,375.13 * 0.003 = 301.13 USDC`. |
| 9 | Bot receives final USDC from DEX B. At break-even, this is just enough to cover Aave and gas. | Receives 100,074.00 USDC. |
| 10 | Bot approves or has already approved Aave Pool to pull principal plus premium. | Owed amount is `100,000 + 50 = 100,050.00 USDC`. |
| 11 | Aave pulls repayment from the bot contract before the transaction ends. | Aave receives 100,050.00 USDC. |
| 12 | Transaction gas is paid by the executor account. | Baseline gas cost is $24.00. |
| 13 | Any USDC left after repayment and gas-equivalent accounting is profit. | At break-even, profit is $0.00. |

## Per-Execution Costs

| Cost | Arithmetic | Cost |
| --- | ---: | ---: |
| Aave flash-loan premium | `100,000 * 0.0005` | 50.00 USDC |
| DEX A LP fee | `100,000 * 0.0005` | 50.00 USDC |
| DEX B LP fee at break-even | `100,375.13 * 0.003` | 301.13 USDC |
| Gas | `400,000 * 20 gwei * $3,000/ETH` | 24.00 USD |
| MEV/searcher bribe | Baseline assumes none | 0.00 USD |

The DEX B fee is variable because it is charged on the WETH sale value, which
changes with the price gap. If the bot submits private order flow with a bribe,
add that bribe to gas in the break-even equation.

## Minimum Price Gap

Let:

```text
L = 100,000.00       principal in USDC
G = gross cross-DEX price gap in USD on the 100,000 trade, before DEX LP fees
a = 0.0005          Aave premium
fA = 0.0005         DEX A fee
fB = 0.0030         DEX B fee
gas = 24.00         gas cost in USD
```

The final USDC after both swaps is:

```text
swapOutput = (L + G) * (1 - fA) * (1 - fB)
swapOutput = (100,000 + G) * 0.9995 * 0.997
swapOutput = (100,000 + G) * 0.9965015
```

The amount that must be covered is:

```text
aaveRepayment = L * (1 + a)
aaveRepayment = 100,000 * 1.0005
aaveRepayment = 100,050.00 USDC

requiredOutput = aaveRepayment + gas
requiredOutput = 100,050.00 + 24.00
requiredOutput = 100,074.00 USDC
```

Break-even requires:

```text
(100,000 + G) * 0.9965015 >= 100,074.00
100,000 + G >= 100,074.00 / 0.9965015
100,000 + G >= 100,425.338045
G >= 425.338045
```

Therefore, with the baseline assumptions, the bot loses money whenever the gross
cross-DEX price gap is below:

```text
$425.34 on the 100,000 USDC trade
```

That is a required raw gap of about:

```text
425.34 / 100,000 = 0.0042534 = 0.42534% = 42.534 bps
```

If the DEX quoter already returns the final USDC amount after LP fees and price
impact, then the decision rule is simpler: execute only when the quoted final
USDC exceeds `100,050.00 + gas + bribe`. Under the baseline gas assumption and no
bribe, the net post-DEX surplus must be at least:

```text
100,074.00 - 100,000.00 = $74.00
```

## Execution Guardrails

- Read `FLASHLOAN_PREMIUM_TOTAL()` from Aave V3 at runtime; do not hardcode 5 bps
  in the trading decision.
- Use DEX quotes that include pool fee, price impact, token decimals, and the
  exact route. The math above is only the baseline model.
- Set `minAmountOut` so the final USDC balance is at least
  `principal + premium + gasBudget + bribe + minimumProfit`.
- Revert unless the contract can repay Aave inside the callback.
- Treat failed transactions as gas losses paid by the executor, even though the
  flash loan and swaps revert.
