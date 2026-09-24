# Flash-Loan Arbitrage Design

This document covers one Ethereum mainnet execution that borrows exactly
100,000 USDC from Aave V3, buys WETH on the cheaper DEX, sells WETH on the
more expensive DEX, repays Aave, and keeps only the surplus. Amounts below
use USDC as USD because USDC has 6 decimals and is assumed to be worth $1.00.

## Assumptions Used For The Numbers

- Borrowed asset: USDC on Ethereum mainnet.
- Borrow amount: `100,000.000000 USDC`.
- Flash-loan venue: Aave V3 `Pool.flashLoanSimple`.
- Aave flash-loan premium: `5 bps = 0.05%`, verified on 2026-09-22 by
  reading `FLASHLOAN_PREMIUM_TOTAL()` from the Ethereum mainnet Aave V3 Pool
  at `0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2`; the call returned `5`.
- DEX pair: USDC/WETH on two separate DEX venues.
- DEX fee assumption for both legs: `5 bps = 0.05%` per swap. This matches a
  common Uniswap V3 fee tier, but the bot must replace this with the actual
  selected pool/router fee for each route before launch.
- Gas model for this design: `450,000 gas` for the Aave callback, two swaps,
  approvals/transfers, checks, and repayment.
- Gas price snapshot: `174,715,040 wei = 0.174715040 gwei`, read from an
  Ethereum mainnet public RPC on 2026-09-22.
- ETH/USD snapshot for gas conversion: `$2,727.05`.
- Builder/searcher bribe: `$0.00` in the base threshold. Any explicit bundle
  payment, coinbase transfer, or higher priority fee must be added dollar for
  dollar to the threshold.

## Single Execution Sequence

The bot should only submit the transaction after an off-chain exact-route
quote and fork/private-bundle simulation show that the final USDC received is
greater than repayment plus gas plus the configured minimum profit.

For the concrete movement example, let:

- `B = 100,000.000000 USDC`
- `dexFee = 0.0005`
- `aaveFee = 0.0005`
- `P = $2,727.05/WETH`, the illustrative average fill price on the cheaper
  first DEX after price impact
- `g = 0.001503397`, the break-even gross price gap derived below

1. The executor calls the arbitrage receiver, which calls Aave V3
   `flashLoanSimple` for `100,000.000000 USDC`.

2. Aave transfers `100,000.000000 USDC` to the receiver.

3. The receiver swaps all `100,000.000000 USDC` on DEX A from USDC to WETH.
   With a `0.05%` DEX fee, DEX A keeps:

   ```text
   100,000.000000 * 0.0005 = 50.000000 USDC
   ```

   The effective input is:

   ```text
   100,000.000000 - 50.000000 = 99,950.000000 USDC
   ```

   At the illustrative average fill price of `$2,727.05/WETH`, the receiver
   gets:

   ```text
   99,950.000000 / 2,727.05 = 36.651326525 WETH
   ```

4. The receiver swaps all `36.651326525 WETH` on DEX B back to USDC. At the
   break-even gross price gap, the DEX B average price is:

   ```text
   2,727.05 * (1 + 0.001503397) = 2,731.149839 USDC/WETH
   ```

   The gross USDC value before the second DEX fee is:

   ```text
   36.651326525 * 2,731.149839 = 100,100.264538 USDC
   ```

   DEX B keeps its `0.05%` fee:

   ```text
   100,100.264538 * 0.0005 = 50.050132 USDC
   ```

   The receiver gets:

   ```text
   100,100.264538 - 50.050132 = 100,050.214405 USDC
   ```

5. The receiver approves or otherwise makes available the Aave repayment:

   ```text
   principal + premium = 100,000.000000 + 50.000000
                       = 100,050.000000 USDC
   ```

6. Aave pulls `100,050.000000 USDC` from the receiver. At the exact
   break-even gap, the receiver has `0.214405 USDC` left, which economically
   reimburses the executor's gas cost. Any amount above that is profit.

7. The transaction requires:

   ```text
   final USDC out >= 100,050.000000 + gasCostUsd + builderTipUsd + minProfitUsd
   ```

   If the check fails, the transaction reverts. In production this should be
   sent through a private relay or simulated bundle so non-included failed
   attempts do not leak the trade or pay public-mempool revert gas.

## Costs Paid

| Cost | Formula | Number |
| --- | ---: | ---: |
| Aave V3 flash-loan premium | `100,000 * 0.0005` | `50.000000 USDC` |
| DEX A swap fee | `100,000 * 0.0005` | `50.000000 USDC` |
| DEX B swap fee at break-even | `100,100.264538 * 0.0005` | `50.050132 USDC` |
| Ethereum gas | `450,000 * 174,715,040 wei / 1e18 * $2,727.05` | `$0.214405` |
| Builder/searcher bribe | Base design assumes none | `$0.000000` |
| USDC transfer fee | USDC has no transfer tax | `$0.000000` |

Base itemized costs at the threshold are approximately:

```text
50.000000 + 50.000000 + 50.050132 + 0.214405 = 150.264537 USD
```

The required gross price gap is slightly higher than this simple subtotal
because the first DEX fee reduces the WETH inventory before the favorable
second-leg price gap is applied.

## Minimum Price Gap

Let:

- `B = 100,000`
- `a = 0.0005`, the Aave premium rate
- `f1 = 0.0005`, the first DEX fee
- `f2 = 0.0005`, the second DEX fee
- `G = 0.214405`, the gas cost in USD
- `T = 0`, the builder/searcher bribe in USD
- `g = gross price gap`, expressed as a fraction of the first DEX average price

After both DEX fees, final USDC received is:

```text
finalOut = B * (1 - f1) * (1 + g) * (1 - f2)
```

The transaction breaks even when:

```text
finalOut = B * (1 + a) + G + T
```

Solving for `g`:

```text
g = ((B * (1 + a) + G + T) / (B * (1 - f1) * (1 - f2))) - 1

g = ((100,000 * 1.0005 + 0.214405 + 0)
      / (100,000 * 0.9995 * 0.9995)) - 1

g = (100,050.214405 / 99,900.025000) - 1

g = 0.001503397
```

As a dollar gap on a `100,000 USDC` trade:

```text
100,000 * 0.001503397 = 150.339708 USD
```

Therefore, with these assumptions, any quoted gross price gap below
`$150.34` on the 100,000 USDC trade loses money before profit target. The
production trigger should be:

```text
requiredGapUsd = 150.339708 + builderTipUsd + minProfitUsd
```

and if either DEX leg uses a higher fee tier, if gas rises, or if the route has
material price impact beyond the exact quote, the threshold must increase.

## Implementation Notes Before Code

- Treat DEX quotes as exact-route, exact-size quotes, not spot prices. The
  100,000 USDC trade can move pool prices, and that movement belongs in the
  quoted `finalOut`.
- Hardcode no profit assumptions. Read Aave's flash-loan premium from the Pool
  during deployment/config checks and read DEX pool fees from the selected
  pools.
- Use `minAmountOut` on both swaps or a final `minProfit` check, preferably
  both.
- Keep a separate ETH balance for gas. Contract USDC profit and executor ETH
  gas are different assets, but the trading decision must convert gas to USD
  and deduct it.
- Re-run the arithmetic per block using current gas, current ETH/USD, current
  selected pool fees, and actual quoted output.

## Sources

- Aave V3 Pool docs describe flash-loan premium configuration in basis points:
  https://docs-aave.vercel.app/docs/aave-v3/smart-contracts/pool
- Aave governance discussion of the current Ethereum V3-style flash-loan
  parameters states `FLASHLOAN_PREMIUM_TOTAL` is 5 bps:
  https://governance.aave.com/t/arfc-aave-v4-activation-on-ethereum-mainnet/24293/4
- Uniswap V3 fee documentation lists the 0.05% fee tier:
  https://developers.uniswap.org/docs/get-started/concepts/fees
- Etherscan gas tracker reference for Ethereum gas being denominated in gwei:
  https://etherscan.io/gastracker/
- ETH/USD snapshot used for the gas conversion:
  https://www.investing.com/crypto/ethereum/eth-usd-historical-data
