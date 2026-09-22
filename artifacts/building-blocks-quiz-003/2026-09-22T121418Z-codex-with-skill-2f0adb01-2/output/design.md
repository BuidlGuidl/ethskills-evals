# Flash-Loan Arbitrage Design

This design covers one Ethereum mainnet execution that borrows 100,000 USDC
from Aave V3, swaps through two DEX pools, repays Aave in the same transaction,
and keeps the remaining USDC.

## Baseline assumptions

- Chain: Ethereum mainnet.
- Loan asset: USDC, treated as $1.00 per USDC.
- Loan size: 100,000 USDC.
- Aave entry point: Aave V3 `Pool.flashLoanSimple`.
- Aave flash-loan premium: 0.05% / 5 bps. The bot should read
  `FLASHLOAN_PREMIUM_TOTAL` before deployment because Aave governance can
  update it.
- DEX route: buy the intermediate asset on DEX A with USDC, then sell the
  intermediate asset on DEX B back to USDC.
- Baseline DEX fees: 0.05% / 5 bps on each swap leg.
- Baseline price impact beyond pool fees: $0. Real execution must use quoted
  `amountOut` values that already include price impact.
- Gas model: 450,000 gas at 1 gwei all-in gas price and ETH at $2,742.08.
  Gas cost = `450,000 * 1 * 10^-9 * 2,742.08 = $1.233936`, rounded to $1.23.
- Explicit builder/MEV bribe: $0 in the baseline. If used, add it directly to
  the break-even cost.

References checked on 2026-09-22:

- Aave V3 flash-loan docs: https://docs-aave.vercel.app/docs/aave-v3/guides/flash-loans
- Ethereum gas formula: https://ethereum.org/developers/docs/gas/
- ETH/USD input: https://metamask.io/en-GB/price/ethereum

## Single-execution sequence

1. The keeper calls the arbitrage contract with:
   - loan asset: USDC
   - loan amount: 100,000 USDC
   - DEX A swap calldata
   - DEX B swap calldata
   - minimum final USDC required

2. The contract calls Aave V3 `Pool.flashLoanSimple` for 100,000 USDC.

3. Aave transfers 100,000 USDC to the contract and calls
   `executeOperation`.

4. The contract swaps the full 100,000 USDC on DEX A into the intermediate
   asset, for example WETH.
   - DEX A input: 100,000 USDC.
   - DEX A fee at 5 bps: `100,000 * 0.0005 = 50.00 USDC`.
   - Amount effectively priced into the pool after the fee:
     `100,000 - 50 = 99,950 USDC`.
   - If DEX A's WETH price is `P_A` USDC per WETH and ignoring price impact,
     WETH received is `99,950 / P_A`.

5. The contract swaps all intermediate asset on DEX B back into USDC.
   - Let `r = P_B / P_A`, where `P_B` is DEX B's USDC price for the same
     intermediate asset.
   - USDC value before the DEX B fee is `99,950 * r`.
   - DEX B fee at 5 bps is `99,950 * r * 0.0005`.
   - Final USDC after both DEX fees is:
     `100,000 * (1 - 0.0005) * (1 - 0.0005) * r`
     = `99,900.025 * r`.

6. The contract approves Aave to pull the repayment amount.
   - Aave principal: 100,000 USDC.
   - Aave premium: `100,000 * 0.0005 = 50.00 USDC`.
   - Total Aave repayment: `100,050 USDC`.

7. Aave pulls 100,050 USDC. If the contract cannot repay this amount, the
   transaction reverts.

8. Any remaining USDC is profit to the bot operator after subtracting the ETH
   gas cost from strategy P&L.

## Cost itemization

| Cost | Arithmetic | Amount |
| --- | ---: | ---: |
| Aave V3 flash-loan premium | `100,000 * 0.0005` | `$50.00` |
| DEX A LP fee | `100,000 * 0.0005` | `$50.00` |
| DEX B LP fee at break-even | `100,101.284578 * 0.0005` | `$50.05` |
| Ethereum gas | `450,000 * 1 gwei * $2,742.08/ETH` | `$1.23` |
| Explicit MEV/builder bribe | baseline | `$0.00` |
| Extra price impact/slippage | baseline | `$0.00` |

At the break-even route, direct fees paid are approximately:

`$50.00 + $50.00 + $50.05 + $1.23 = $151.28`

The gross pre-fee price gap required is slightly higher than direct fees paid,
because DEX fees also apply to the extra gross value created by the price gap.

## Break-even price gap

There are two useful ways to express the threshold.

### Runtime threshold using actual DEX quotes

If the DEX quote already includes pool fees and price impact, the bot only
needs to compare final expected USDC against the Aave repayment plus gas:

`minimum final USDC = principal + Aave premium + gas`

`minimum final USDC = 100,000 + 50.00 + 1.233936 = 100,051.233936 USDC`

So the two swaps must quote at least `$51.233936` more than the borrowed
principal after DEX fees and price impact. Below that, the strategy loses money.

### Headline pre-fee DEX price gap

If the price gap is measured before DEX fees, let `G` be the gross USDC gap on
the 100,000 USDC trade.

Final USDC after two 5 bps DEX fees:

`(100,000 + G) * (1 - 0.0005)^2`

Break-even condition:

`(100,000 + G) * 0.99900025 = 100,000 + 50.00 + 1.233936`

Solve for `G`:

`G = (100,051.233936 / 0.99900025) - 100,000`

`G = 151.360258`

Minimum gross price gap:

- `$151.36` on the 100,000 USDC trade.
- Equivalent spread: `151.360258 / 100,000 = 0.151360%`.
- Equivalent DEX price ratio: `P_B / P_A >= 1.0015136026`.

Any gross gap below `$151.36` loses money under these assumptions. If gas,
DEX fee tiers, price impact, or builder payments are higher than assumed here,
the required gap increases by the same logic.
