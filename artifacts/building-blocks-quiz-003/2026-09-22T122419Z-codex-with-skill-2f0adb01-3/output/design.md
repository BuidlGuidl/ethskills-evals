# Flash-Loan Arbitrage Design

## Scope and assumptions

This design covers one Ethereum mainnet execution that borrows 100,000 USDC from Aave V3, swaps USDC into an intermediate asset on DEX A, swaps the intermediate asset back into USDC on DEX B, repays Aave, and keeps any remaining USDC.

Baseline assumptions for the arithmetic:

- Loan asset: USDC.
- Flash-loan principal: 100,000 USDC.
- Aave V3 flash-loan premium: 5 bps, or 0.05%.
- DEX route: two 5 bps pools, one on each DEX.
- Gas used by the transaction: 500,000 gas.
- Gas price: 15 gwei.
- ETH price for gas accounting: 3,000 USD/ETH.
- Intermediate asset example: WETH.
- Price impact is handled by live DEX quotes and `amountOutMinimum`; it is not treated as a fixed cost in this static estimate.

References for the configurable protocol assumptions:

- Aave V3 Ethereum flash-loan premium is 5 bps in the current Ethereum configuration: https://governance.aave.com/t/arfc-aave-v4-activation-on-ethereum-mainnet/24293
- Uniswap-style V3 pools commonly expose 0.05%, 0.30%, and 1.00% fee tiers; this design uses 0.05% pools for the baseline: https://developers.uniswap.org/docs/get-started/concepts/fees

## Single-execution sequence

1. The bot identifies a price discrepancy.
   - DEX A sells WETH cheaper than DEX B buys it.
   - The opportunity must clear the break-even threshold below before the bot submits a transaction.

2. The arbitrage contract requests a flash loan from the Aave V3 Pool.
   - USDC received by the contract: 100,000.00 USDC.
   - USDC owed at the end of the transaction: 100,000.00 + 50.00 = 100,050.00 USDC.

3. The contract swaps USDC to WETH on DEX A.
   - Input to DEX A: 100,000.00 USDC.
   - DEX A fee at 5 bps: 100,000.00 * 0.0005 = 50.00 USDC.
   - Effective USDC used after the pool fee: 99,950.00 USDC, before pool price impact.
   - Example at a 3,000.00 USDC/WETH execution price: 99,950.00 / 3,000.00 = 33.316666 WETH.

4. The contract swaps WETH back to USDC on DEX B.
   - Input to DEX B: all WETH received from DEX A.
   - Baseline DEX B notional: about 100,000.00 USD.
   - DEX B fee at 5 bps: about 100,000.00 * 0.0005 = 50.00 USDC.
   - Required USDC output after both swaps must be high enough to repay Aave and cover gas.

5. The contract checks profitability.
   - Minimum final USDC balance before Aave repayment: 100,050.00 USDC plus gas cost in USDC terms.
   - With the baseline gas assumption below, minimum final balance before repayment is 100,072.50 USDC.
   - If final USDC is below that amount, the transaction should revert.

6. The contract approves and repays Aave.
   - Principal repaid: 100,000.00 USDC.
   - Flash-loan premium repaid: 50.00 USDC.
   - Total Aave pull: 100,050.00 USDC.

7. The contract keeps profit.
   - Profit = final USDC after swaps - 100,050.00 USDC - gas cost.
   - Example: if final USDC after swaps is 100,250.00, profit is 100,250.00 - 100,050.00 - 22.50 = 177.50 USD.

## Per-execution costs

| Cost | Calculation | Amount |
| --- | ---: | ---: |
| Aave V3 flash-loan premium | 100,000.00 * 0.05% | 50.00 USDC |
| DEX A swap fee | 100,000.00 * 0.05% | 50.00 USDC |
| DEX B swap fee | about 100,000.00 * 0.05% | about 50.00 USDC |
| Gas | 500,000 * 15 gwei = 0.0075 ETH; 0.0075 * 3,000 | 22.50 USD |
| Explicit baseline cost | 50.00 + 50.00 + 50.00 + 22.50 | 172.50 USD |

Notes:

- Failed executions that revert still pay gas. The flash-loan repayment and DEX swaps revert with the transaction, so the main failed-execution loss is gas.
- Price impact and slippage are real costs, but they are quote-dependent. The implementation should use onchain or trusted simulated quotes that already include pool price impact, then enforce `amountOutMinimum`.
- Any builder tip, private relay payment, or priority fee above the 15 gwei gas assumption adds directly to the break-even amount.
- Contract deployment, token approvals set during deployment/setup, monitoring infrastructure, and offchain search costs are not per-execution costs and are excluded from this table.

## Minimum price gap

Using the baseline assumptions, the bot loses money when the gross price gap on the 100,000 USDC trade is below the explicit per-execution cost:

```text
minimum gross gap
= Aave flash-loan premium
  + DEX A fee
  + DEX B fee
  + gas

= 50.00
  + 50.00
  + 50.00
  + 22.50

= 172.50 USD
```

As a percentage of the 100,000 USDC trade:

```text
172.50 / 100,000.00 = 0.001725 = 0.1725% = 17.25 bps
```

So, under this baseline, any gross price gap below 172.50 USD on the 100,000 USDC round trip loses money.

The production trigger should round this up for safety. A reasonable first threshold is:

```text
minimum execution threshold = 175.00 USD
```

If the bot uses DEX quotes that are already net of both swap fees and price impact, the runtime check can be simpler:

```text
required quoted final USDC
= principal + Aave premium + gas
= 100,000.00 + 50.00 + 22.50
= 100,072.50 USDC
```

In that quote-net model, the quoted round-trip surplus must be at least 72.50 USDC above the borrowed 100,000 USDC, because the DEX fees and price impact have already been baked into the quote.
