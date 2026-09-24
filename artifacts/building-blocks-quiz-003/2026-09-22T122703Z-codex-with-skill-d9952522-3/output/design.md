# Flash-Loan Arbitrage Design

Date: 2026-09-22

## Scope and Cost Assumptions

This design covers one Ethereum mainnet execution that borrows 100,000 USDC from Aave V3, swaps USDC -> WETH on DEX A, swaps WETH -> USDC on DEX B, repays Aave, and leaves any surplus USDC in the bot.

Baseline assumptions for the arithmetic:

- Borrow asset: USDC, valued at 1.00 USD per USDC.
- Borrow amount: 100,000 USDC.
- Aave path: `flashLoanSimple()` for a single reserve.
- Aave flash-loan premium: 0.05%, so 50.00 USDC on a 100,000 USDC loan. Aave docs say the fee is initialized at 0.05% and can be updated by governance; production code must read `FLASHLOAN_PREMIUM_TOTAL()` before quoting.
- DEX route: two constant-function DEX swaps, modeled as 5 bps per swap. Uniswap v3 docs list 0.05%, 0.30%, and 1.00% as standard v3 fee tiers; replace these inputs with the actual pool fees selected for DEX A and DEX B.
- Gas budget: 650,000 gas for one transaction including flash-loan callback, two router swaps, token approvals, checks, and events.
- Gas price snapshot: 0.326 gwei fast effective gas from gweiprice.com, with ETH at 2,743 USD from gwei.ryanio.com.
- Builder/private-relay payment: 0.00 USD in the baseline. Any explicit builder payment, backrun payment, or extra priority fee reduces profit dollar-for-dollar.

Sources checked on 2026-09-22:

- Aave V3 flash-loan docs: https://docs-aave.vercel.app/docs/aave-v3/guides/flash-loans
- Uniswap fee docs: https://developers.uniswap.org/docs/get-started/concepts/fees
- Ethereum gas snapshot: https://gweiprice.com/ and https://gwei.ryanio.com/

## Single-Execution Sequence

1. The keeper submits one transaction to the arbitrage contract with the chosen route, minimum acceptable output, and deadline.

   Amount moving: keeper pays transaction gas in ETH. No USDC moves yet.

2. The arbitrage contract calls Aave V3 `Pool.flashLoanSimple()` for 100,000 USDC.

   Amount moving: request for 100,000 USDC.

3. Aave transfers 100,000 USDC to the arbitrage contract and calls `executeOperation()`.

   Amount moving into bot: 100,000 USDC.

4. The bot swaps the full 100,000 USDC on DEX A into WETH.

   With the 5 bps baseline fee:

   - USDC sent to DEX A: 100,000.000000 USDC.
   - DEX A pool fee: 100,000 * 0.0005 = 50.000000 USDC.
   - USDC notional remaining for the swap: 99,950.000000 USDC.
   - WETH received: determined by DEX A pool price and price impact. At an illustrative 2,743 USD/ETH and zero price impact, this is 99,950 / 2,743 = 36.438206 WETH.

5. The bot swaps all WETH on DEX B back into USDC.

   With the 5 bps baseline fee and no cross-DEX price gap:

   - WETH sent to DEX B: all WETH received from step 4.
   - USDC notional before DEX B fee: about 99,950.000000 USDC.
   - DEX B pool fee: 99,950 * 0.0005 = 49.975000 USDC.
   - USDC received before any arbitrage edge: 99,900.025000 USDC.

   If the gross pre-fee cross-DEX price gap on the 100,000 USDC trade is `G` USD, the approximate USDC received after both DEX fees is:

   ```text
   100,000 + G - 99.975 = 99,900.025 + G USDC
   ```

   In implementation, the router quote is the authority: use quoted `amountOut` values that already include pool fees and price impact.

6. The bot approves Aave to pull principal plus premium.

   Amount approved:

   ```text
   principal + premium = 100,000 + 50 = 100,050 USDC
   ```

7. Aave pulls 100,050 USDC from the bot at the end of the flash-loan callback.

   Amount moving back to Aave: 100,050 USDC.

8. The bot keeps any remaining USDC.

   Baseline ending USDC before gas conversion:

   ```text
   final_usdc = 99,900.025 + G - 100,050
              = G - 149.975 USDC
   ```

   Gas is paid separately by the transaction sender in ETH, so the economic profit is:

   ```text
   profit_usd = G - 149.975 - gas_usd - builder_payment_usd
   ```

## Itemized Costs

Baseline costs on a 100,000 USDC trade:

| Cost item | Formula | Cost |
| --- | ---: | ---: |
| Aave V3 flash-loan premium | 100,000 * 0.05% | 50.000 USDC |
| DEX A swap fee | 100,000 * 0.05% | 50.000 USDC |
| DEX B swap fee | 99,950 * 0.05% | 49.975 USDC |
| Gas | 650,000 * 0.326 gwei * 2,743 USD/ETH / 1e9 | 0.581 USD |
| Builder/private relay payment | baseline assumption | 0.000 USD |
| Total baseline cost | sum above | 150.556 USD |

Notes:

- Price impact is not a fixed fee, but it reduces the router `amountOut`. Treat it as part of the quote, not as a separate constant.
- Failed transactions still pay gas. A reverted arb loses the gas cost even if the flash loan itself unwinds.
- If the chosen pools charge 30 bps on each leg, the DEX fee drag becomes `100,000 * (1 - (1 - 0.003)^2) = 599.100 USD`, and the total baseline cost becomes `599.100 + 50.000 + 0.581 = 649.681 USD`.
- If a builder payment or extra priority fee is needed for inclusion, add it directly to the total cost.

## Break-Even Price Gap

For the baseline 5 bps + 5 bps route, the gross pre-fee price gap must exceed total baseline cost:

```text
DEX fee drag = 100,000 * (1 - (1 - 0.0005)^2)
             = 100,000 * (1 - 0.99900025)
             = 99.975 USD

Aave premium = 100,000 * 0.0005
             = 50.000 USD

Gas cost = 650,000 * 0.326 * 2,743 / 1,000,000,000
         = 0.581 USD

Minimum gross price gap = 99.975 + 50.000 + 0.581
                         = 150.556 USD
```

So this bot loses money below a gross pre-fee cross-DEX price gap of about 150.56 USD on the 100,000 USDC trade, equal to:

```text
150.556 / 100,000 = 0.00150556 = 0.150556% = 15.0556 bps
```

If comparing executable router quotes that already include DEX fees and price impact, the required surplus is lower because the two DEX fees are already inside `amountOut`:

```text
minimum quoted surplus over borrowed principal
= Aave premium + gas + builder payment
= 50.000 + 0.581 + 0.000
= 50.581 USDC
```

Operational rule:

```text
expected_final_usdc >= 100,000 + 50.581 + safety_buffer
```

Use a positive safety buffer for stale quotes, state changes between simulation and inclusion, and MEV competition. A 25 USD buffer would move the baseline no-run threshold from 150.56 USD to 175.56 USD gross pre-fee gap.
