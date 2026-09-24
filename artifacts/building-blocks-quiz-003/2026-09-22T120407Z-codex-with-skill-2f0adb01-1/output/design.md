# Flash-Loan Arbitrage Design

This design describes one Ethereum mainnet execution that borrows 100,000 USDC from Aave V3, buys an intermediary asset on a cheaper DEX, sells it on a more expensive DEX, repays Aave in the same transaction, and keeps the remaining USDC.

## Snapshot assumptions

- Chain: Ethereum mainnet.
- Flash lender: Aave V3 Pool.
- Borrowed asset: USDC.
- Borrow size: 100,000.00 USDC.
- Aave V3 flash-loan premium: 5 bps, or 0.05%.
- Route shape: USDC -> WETH on DEX A, then WETH -> USDC on DEX B.
- DEX fee tier used for the worked example: 5 bps on each swap.
- Worked cheap-side WETH price on DEX A: 2,700.00 USDC/WETH before DEX fee.
- Gas assumption: 450,000 gas at 0.20 gwei, with ETH at 2,733.01 USD.
- Explicit builder bribe: 0.00 USD in the base calculation.
- Price impact: not modeled as a separate fixed number here. The production bot must use exact-in executable quotes for the full 100,000 USDC size, so pool fees and price impact are already reflected in the quoted outputs. If using mid-prices instead of executable quotes, add price impact to the break-even gap.

The contract should still read Aave's `FLASHLOAN_PREMIUM_TOTAL` before execution instead of hard-coding the premium forever.

## Single-execution sequence

1. The searcher finds a route where DEX A is cheaper than DEX B for the same asset pair. The transaction includes the DEX addresses, encoded swap paths, deadlines, and minimum output values.

2. The bot calls Aave V3 for a simple flash loan of 100,000.00 USDC.

3. Aave transfers 100,000.00 USDC to the bot contract.

4. The bot swaps the full 100,000.00 USDC on DEX A:

   - Input sent to DEX A: 100,000.00 USDC.
   - DEX A 5 bps LP fee: 100,000.00 * 0.0005 = 50.00 USDC.
   - Effective notional buying WETH: 99,950.00 USDC.
   - At 2,700.00 USDC/WETH, WETH received: 99,950.00 / 2,700.00 = 37.018518 WETH.

5. The bot swaps the 37.018518 WETH on DEX B back to USDC. At the break-even raw price gap calculated below, DEX B's pre-fee price is 2,704.060134 USDC/WETH:

   - WETH input sent to DEX B: 37.018518 WETH.
   - Pre-fee USDC value on DEX B: 37.018518 * 2,704.060134 = 100,100.300150 USDC.
   - DEX B 5 bps LP fee: 100,100.300150 * 0.0005 = 50.050150 USDC.
   - USDC received from DEX B: 100,100.300150 - 50.050150 = 100,050.25 USDC.

6. The bot approves Aave to pull the repayment amount:

   - Principal: 100,000.00 USDC.
   - Aave premium: 100,000.00 * 0.0005 = 50.00 USDC.
   - Total repaid to Aave: 100,050.00 USDC.

7. Aave pulls 100,050.00 USDC before the transaction finishes.

8. The bot's remaining USDC is the trade surplus:

   - USDC after second swap: 100,050.25.
   - USDC repaid to Aave: 100,050.00.
   - On-chain USDC left in bot: 0.25 USDC.
   - Gas paid by transaction sender: about 0.25 USD in ETH.
   - Net profit at this exact worked gap: 0.00 USD after gas.

If any minimum output check fails, or if the final USDC balance is less than the Aave repayment plus the required profit threshold, the bot reverts. A reverted execution still pays gas, but it does not pay the Aave premium or DEX LP fees because the swaps and flash loan are reverted.

## Itemized costs

| Cost | Calculation | Amount |
| --- | ---: | ---: |
| Aave V3 flash-loan premium | 100,000.00 * 0.05% | 50.00 USDC |
| DEX A LP fee | 100,000.00 * 0.05% | 50.00 USDC |
| DEX B LP fee at break-even | 100,100.300150 * 0.05% | 50.050150 USDC |
| Gas | 450,000 * 0.20 gwei = 0.00009 ETH; 0.00009 * 2,733.01 USD | 0.25 USD |
| Explicit builder bribe | Base design assumes none | 0.00 USD |
| Static offchain infra cost | Not paid by this transaction | 0.00 USD |

Total transaction-level economic drag at the break-even example is:

```text
50.00 Aave premium
+ 50.00 DEX A fee
+ 50.050150 DEX B fee
+ 0.25 gas
= 150.300150 USD
```

The required raw DEX price gap is slightly higher than that itemized sum because DEX fees compound against the round trip.

## Break-even price gap

Define the raw price gap as the dollar advantage on a 100,000 USDC trade before DEX LP fees, Aave premium, and gas. In other words, a 150.38 USD raw gap means DEX B's pre-fee price is higher than DEX A's pre-fee price by about 0.15038% for this trade.

Break-even condition:

```text
borrowed_amount * (1 + raw_gap / borrowed_amount) * (1 - dex_fee)^2
>= borrowed_amount + aave_premium + gas_usd
```

Plugging in the numbers:

```text
100,000 * (1 + raw_gap / 100,000) * (1 - 0.0005)^2
>= 100,000 + 50.00 + 0.25
```

Solve for `raw_gap`:

```text
raw_gap
= (100,050.25 / (0.9995^2)) - 100,000
= 150.375338 USD
```

So the bot loses money when the raw price gap on the 100,000 USDC trade is below 150.38 USD, or about 0.15038%.

For implementation, the safer gate is based on executable quotes after DEX fees and price impact:

```text
required_second_swap_output
= borrowed_amount + aave_premium + gas_usd + desired_profit_buffer
= 100,000.00 + 50.00 + 0.25 + desired_profit_buffer
= 100,050.25 + desired_profit_buffer USDC
```

With no desired profit buffer, the post-DEX executable quote must return at least 100,050.25 USDC. In practice the bot should require more than break-even to cover gas movement, quote staleness, MEV risk, and failed-attempt gas.
