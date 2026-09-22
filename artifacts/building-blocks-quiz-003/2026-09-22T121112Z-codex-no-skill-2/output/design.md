# Flash-Loan Arbitrage Design

This design covers one Ethereum mainnet execution that borrows `100,000 USDC`
from Aave V3, buys WETH on one DEX, sells that WETH on a second DEX, repays the
flash loan, and keeps any remaining USDC.

## Baseline Assumptions

The numbers below are a concrete baseline for deciding whether an opportunity is
worth sending on-chain.

| Item | Baseline |
| --- | ---: |
| Flash-loan principal | `100,000.00 USDC` |
| Borrowed asset | USDC |
| Intermediate asset | WETH |
| Aave V3 flash-loan premium | `0.05%` |
| DEX A fee | `0.30%` |
| DEX B fee | `0.30%` |
| Estimated gas used | `500,000 gas` |
| Effective gas price | `2 gwei` |
| ETH/USD used for gas conversion | `$2,730` |
| Gas cost | `500,000 * 2 gwei * $2,730 / 1e9 = $2.73` |

Aave V3's flash-loan premium is initialized at `0.05%` and can be changed by
governance, so the bot should read the live premium from the Pool contract before
using this value in production. Uniswap V3-style pools can have different fee
tiers, so the two `0.30%` swap fees here are a conservative worked example, not a
constant.

## Single-Execution Sequence

The example below shows the amounts at the exact break-even price gap for the
baseline assumptions. At this gap, the bot ends with `0.00 USDC` profit after all
listed costs.

1. Start the transaction.
   - Bot wallet holds enough ETH to pay gas.
   - Bot does not need to hold the `100,000 USDC` principal.

2. Borrow from Aave V3.
   - Aave sends the bot: `100,000.00 USDC`.
   - Required repayment later in the same transaction:
     - Principal: `100,000.00 USDC`
     - Aave premium: `100,000 * 0.05% = 50.00 USDC`
     - Total owed to Aave: `100,050.00 USDC`

3. Swap USDC to WETH on DEX A.
   - Input to DEX A: `100,000.00 USDC`
   - DEX A fee: `100,000 * 0.30% = 300.00 USDC`
   - Net USDC executed against pool price: `99,700.00 USDC`
   - Example DEX A executable price before fee: `$2,700.00 / WETH`
   - WETH received: `99,700 / 2,700 = 36.92592593 WETH`

4. Swap WETH back to USDC on DEX B.
   - Input to DEX B: `36.92592593 WETH`
   - Break-even DEX B executable price before fee:
     - `$2,700 * (1 + 0.0065575865) = $2,717.70548355 / WETH`
   - Gross USDC before DEX B fee:
     - `36.92592593 * 2,717.70548355 = 100,353.791374 USDC`
   - DEX B fee:
     - `100,353.791374 * 0.30% = 301.061374 USDC`
   - USDC received after DEX B fee:
     - `100,353.791374 - 301.061374 = 100,052.73 USDC`

5. Repay Aave.
   - Repay principal plus premium: `100,050.00 USDC`
   - USDC remaining before gas: `100,052.73 - 100,050.00 = 2.73 USDC`

6. Pay Ethereum gas.
   - Gas paid from bot wallet in ETH:
     - `500,000 gas * 2 gwei = 0.001 ETH`
   - USD value of gas:
     - `0.001 ETH * $2,730 = $2.73`
   - Profit after gas at break-even: `2.73 - 2.73 = 0.00 USDC`

7. Finish.
   - If the final USDC balance is greater than the required repayment plus the
     USD value of gas, keep the difference as profit.
   - If the final USDC balance is lower, the transaction should revert before
     repayment so the bot avoids losing principal. The bot still loses gas on a
     reverted transaction.

## Cost Inventory

| Cost | Arithmetic | Amount |
| --- | --- | ---: |
| Aave V3 flash-loan premium | `100,000 * 0.05%` | `50.00 USDC` |
| DEX A LP fee | `100,000 * 0.30%` | `300.00 USDC` |
| DEX B LP fee at break-even | `100,353.791374 * 0.30%` | `301.061374 USDC` |
| Gas | `500,000 * 2 gwei * $2,730 / 1e9` | `$2.73` |
| Explicit builder bribe / private relay fee | Baseline assumes none beyond gas | `$0.00` |
| Token approval setup | Pre-approved outside this execution | `$0.00` |

Baseline listed costs at break-even:

```text
50.00 + 300.00 + 301.061374 + 2.73 = 653.791374 USDC
```

Price impact is not a separate fixed line item in this design. It must be
included in the executable quotes used for DEX A and DEX B. If quoting starts
from pool mid-prices instead of exact-input or exact-output quotes, then price
impact must be added as another cost before the bot decides to run.

## Minimum Profitable Price Gap

Let:

```text
P = 100,000.00
a = 0.0005       Aave flash-loan premium
f1 = 0.003       DEX A fee
f2 = 0.003       DEX B fee
gas_usd = 2.73
g = required gross price gap as a fraction of the 100k trade
```

The bot breaks even when the USDC received after both DEX fees equals the Aave
repayment plus gas:

```text
P * (1 + g) * (1 - f1) * (1 - f2) = P * (1 + a) + gas_usd
```

Substitute the baseline values:

```text
100,000 * (1 + g) * 0.997 * 0.997 = 100,000 * 1.0005 + 2.73
100,000 * (1 + g) * 0.994009 = 100,052.73
1 + g = 100,052.73 / 99,400.90
g = 0.0065575865
```

Minimum gross price gap:

```text
0.0065575865 * 100,000 = 655.75865
```

So, under the baseline assumptions, any opportunity with a gross price gap below
`$655.76` on the `100,000 USDC` trade loses money. The bot should require a
higher threshold than this, for example `$700+`, to leave room for quote drift,
rounding, priority-fee changes, and failed-transaction gas.
