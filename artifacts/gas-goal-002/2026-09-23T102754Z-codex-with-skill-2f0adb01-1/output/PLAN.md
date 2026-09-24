# Base Gas Cost Plan

Live measurement taken on 2026-09-23 at ~10:34 UTC using `scripts/base-gas-report.js`:

| Input | Value |
| --- | ---: |
| Transfers | 40,000/day |
| Network | Base |
| Token used for measurement | USDC on Base (`0x833589fcd6edb6e08f4c7c32d4f71b54bda02913`) |
| ETH/USD | $2,730.83 |
| Base gas price | 0.006 gwei |
| Latest Base base fee | 0.005 gwei |
| ERC-20 transfer gas | 45,415 gas |
| Transfer gas source | `eth_estimateGas` from a recent Transfer holder |

Formula:

```text
cost = gas_used * gas_price_wei / 1e18 * ETH_USD
```

Current run-rate:

| Metric | Cost |
| --- | ---: |
| Cost per ERC-20 transfer | $0.000744 |
| Cost per day | $29.76 |
| Cost per 30-day month | $892.95 |
| Cost per year | $10,864 |

The key finance takeaway: Base gas is already very cheap. At current fees the entire relayer gas bill is under $900/month for 1.2M transfers/month. The only changes that matter are the ones that reduce transaction count, remove per-transaction overhead, or prevent accidental overpayment.

## Ranked Changes

| Rank | Change | Savings at current fees | Status |
| ---: | --- | ---: | --- |
| 1 | Batch payouts through a payout contract | ~$11.80/day, ~$354/month, ~$4,307/year | Implemented in `contracts/BatchERC20Payout.sol` |
| 2 | Enforce Base-specific fee caps and low priority fee | $0 if already tuned; ~$44.6/day if currently tipping 0.01 gwei; ~$492/day if tipping 0.1 gwei | Implemented in `scripts/base-fee-policy.js` |
| 3 | Net, coalesce, or suppress avoidable transfers | ~$0.000744 per skipped transfer; every 1% volume reduction saves ~$0.30/day and ~$8.93/month | Product/data work |
| 4 | Delay non-urgent transfers during gas spikes | $0 at current fees; up to ~$218/day if a 0.05 gwei day is delayed back to 0.006 gwei | Fee policy helper blocks above ceiling |
| 5 | Move from Base to another L2 | Usually negligible for ERC-20 transfers; likely less than batching saves | Not recommended now |

## 1. Batch Payouts

Today every recipient pays the full transaction envelope. A batch transaction still performs one ERC-20 transfer per recipient, but it amortizes the L2 transaction overhead across the batch. I modeled a conservative 18,000 gas saved per recipient.

```text
18,000 gas * 0.006 gwei * $2,730.83 / 1e9 = $0.00029493 saved/transfer
$0.00029493 * 40,000 transfers/day = $11.80/day
```

What shipped:

- `contracts/BatchERC20Payout.sol`
- `MAX_BATCH_SIZE = 500`
- Owner-only `batchTransfer(token, recipients, amounts)`
- Safe handling for ERC-20s that return no boolean
- `recoverToken` for operational recovery

Operational notes:

- The contract should hold the payout token balance. That gives the best gas profile.
- If downstream accounting depends on the token `Transfer.from` being the current EOA relayer, treat the batch contract as the new relayer wallet.
- Validate batch size against block gas and your operational retry model. `500` is a ceiling, not necessarily the best production chunk size.

## 2. Fee Caps

The measured Base priority fee was about 0.001 gwei. Many legacy relayers still use mainnet-era defaults like 0.01-0.1 gwei. On Base, that is real waste because the priority fee is paid.

Savings if currently tipping 0.01 gwei:

```text
(0.01 - 0.001) gwei * 45,415 gas * 40,000/day * $2,730.83 / 1e9
= ~$44.6/day
```

Savings if currently tipping 0.1 gwei:

```text
(0.1 - 0.001) gwei * 45,415 gas * 40,000/day * $2,730.83 / 1e9
= ~$492/day
```

What shipped:

- `scripts/base-fee-policy.js`
- Reads live `eth_feeHistory`
- Uses current Base median priority fee, capped at 0.002 gwei by default
- Sets `maxFeePerGas = 2 * latestBaseFee + priority`
- Throws when the target exceeds a default 0.05 gwei ceiling

Run it:

```bash
npm run gas:fee-policy
```

Latest output from this workspace:

```json
{
  "maxFeePerGasGwei": 0.011,
  "maxPriorityFeePerGasGwei": 0.001,
  "latestBaseFeeGwei": 0.005
}
```

## 3. Reduce Transfer Count

Every skipped transfer saves the full current per-transfer cost:

```text
45,415 gas * 0.006 gwei * $2,730.83 / 1e9 = $0.000744
```

At 40,000 transfers/day:

| Volume reduction | Savings/day | Savings/month |
| ---: | ---: | ---: |
| 1% | $0.30 | $8.93 |
| 5% | $1.49 | $44.65 |
| 10% | $2.98 | $89.29 |

This only beats batching if a large share of payments can be netted or suppressed. Good candidates are same-user same-token retries, dust payouts, payout reversals, and multiple payouts to the same address inside the same settlement window.

## 4. Spike Handling

At current gas, delaying is not worth product latency. During spikes it is.

Example if Base gas is 0.05 gwei instead of 0.006 gwei:

```text
(0.05 - 0.006) gwei * 45,415 gas * 40,000/day * $2,730.83 / 1e9
= ~$218/day avoided
```

The shipped fee policy helper enforces a ceiling so non-urgent jobs can pause rather than overpay. For urgent payments, keep a separate lane with a higher ceiling and alerting.

## 5. Not Recommended

- Moving away from Base only for gas: Base ERC-20 transfer costs are already sub-tenth-cent. Migration risk will swamp gas savings unless there is another product reason.
- ERC-4337/paymasters for cost reduction: useful for UX, but usually adds verification overhead.
- More aggressive Solidity micro-optimization before batching: there is no app contract in this repo to optimize, and the relayer cost is dominated by per-transfer transaction overhead.

## Shipped Commands

```bash
npm run gas:report
npm run gas:report:markdown
npm run gas:fee-policy
HOME=$PWD/.home FOUNDRY_CACHE_PATH=$PWD/cache forge build
```
