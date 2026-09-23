# Base ERC-20 Gas Plan

Measured on 2026-09-23 at 10:41 UTC.

## Baseline

Live readings:

- Base `eth_gasPrice`: `6,000,000 wei` = `0.006 gwei`
- Base latest `baseFeePerGas`: `5,000,000 wei` = `0.005 gwei`
- ETH/USD: `$2,737.085`
- Workload: `40,000` ERC-20 transfers/day from our relayer

Recent Base ERC-20 transfer sample:

- Sample: 25 recent transactions whose calldata starts with `transfer(address,uint256)`
- Average gas used: `48,318`
- Average receipt `l1Fee`: `3,423,585,668 wei`
- Median effective gas price: `0.00605 gwei`

Formula:

```text
cost_per_transfer =
  ((gas_used * gas_price_wei) + l1_fee_wei) / 1e18 * eth_usd
```

Current spend estimate using live Base gas:

- Per transfer: `$0.000803`
- Per day: `$32.11`
- Per 30-day month: `$963.45`
- Per year: `$11,721.95`

Using the sampled effective gas price instead of the live `eth_gasPrice`, the estimate is `$13,006.91/year`.

For exact finance accounting, export production relayer transaction hashes and run:

```bash
TX_HASHES="0xhash1 0xhash2 ..." npm run gas:base
```

The reporter reads each receipt's `gasUsed`, `effectiveGasPrice`, and OP-stack `l1Fee`.

## Ranked Changes

### 1. Fix relayer fee caps if receipts show over-tipping

Expected savings with current public median: about `$96/year`, because recent Base transfers are already near `0.006 gwei`.

This becomes the largest saving if our relayer has a hardcoded gas price. At `0.1 gwei`, keeping the same `48,318` gas transfer and current ETH price, the overpay versus `0.006 gwei` is:

```text
48,318 * (0.1 - 0.006) gwei * 40,000/day * 365 * ETH/USD
= about $181,200/year
```

Action:

- Use `scripts/base-gas-report.mjs` against relayer receipts.
- If the relayer's median `effectiveGasPrice` is materially above Base `eth_gasPrice`, derive EIP-1559 fields immediately before send instead of hardcoding a mainnet-style priority fee.
- On Base right now, this means fees near the live `eth_gasPrice`, not `0.1+ gwei` constants.

Code shipped:

- `npm run gas:base` reports live Base fees and sampled transfer costs.
- `TX_HASHES="..." npm run gas:base` reports actual relayer receipt costs.

### 2. Batch transfers through a distributor contract

Savings if all 40,000/day are batchable: about `$5,540/year`.

Measured repo benchmark:

- Current sampled transfer: `48,318` gas each
- `BatchTokenDistributor.distribute` with 100 recipients: `2,521,884` gas total
- Batched gas per recipient: `25,219`
- Execution gas saved per recipient: `23,099`

Dollar math:

```text
23,099 gas * 0.006 gwei * ETH/USD = $0.000379 saved/transfer
$0.000379 * 40,000/day = $15.18/day
$15.18/day * 365 = $5,540/year
```

Action:

- Use `src/BatchTokenDistributor.sol` for tokens we custody.
- Fund the distributor contract, authorize only relayer operator keys, and send up to the largest batch size that fits our latency and block gas limits.
- Pilot with production token contracts before full rollout because ERC-20 storage behavior varies by token.

Code shipped:

- `src/BatchTokenDistributor.sol`
- `test/BatchTokenDistributor.t.sol`

### 3. Avoid transfers through netting or payout thresholds

Savings scale exactly with avoided transfers:

- Avoid 10% of transfers: about `$1,172/year`
- Avoid 25% of transfers: about `$2,930/year`
- Avoid 50% of transfers: about `$5,861/year`

This beats batching only if we can avoid more than about 47% of transfers, because batching saves roughly 47% of the current per-transfer cost.

Action:

- Net multiple same-recipient payments into one transfer per settlement window.
- Add minimum payout thresholds where product and compliance allow it.
- Keep immediate settlement for flows where latency matters more than the sub-cent gas cost.

### 4. Optimize calldata/L1 data only after batching and fee checks

Current L1 fee is small:

```text
3,423,585,668 wei * ETH/USD * 40,000/day * 365
= about $137/year
```

Action:

- Do not spend engineering time on calldata compression for simple ERC-20 transfers until receipt data shows a materially larger `l1Fee`.
- Recheck this after batching, because batch calldata and receipt behavior may change the L1 component.

### 5. Do not move chains for gas alone right now

Base transfer gas is currently about `$11.7k/year` for this workload. A migration has bridge, liquidity, integration, compliance, and operational risk, so it needs a separate non-gas reason unless live measurements on another chain show a very large delta.

## Shipping Checklist

- Run `npm test` before deployment.
- Run `npm run gas:base` daily and store the JSON output for finance.
- Run `TX_HASHES="..." npm run gas:base` on a full production day before and after each change.
- Deploy `BatchTokenDistributor` only after a production-token pilot and signer review.
