# Base ERC-20 Gas Plan

Snapshot taken 2026-09-23 11:56 UTC with `npm run gas:report`.

Sources and live inputs:

- Base RPC `https://mainnet.base.org`: `eth_gasPrice = 0.006 gwei`, latest Base base fee `0.005 gwei`, p50 priority fee from `eth_feeHistory = 0.00091895 gwei`.
- CoinGecko ETH/USD: `$2,726.37`.
- Recent Base USDC transfer receipts sampled from token `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`: median `$0.000886` per transfer, average `$0.004758` per transfer because one sampled transaction over-tipped heavily.
- Conservative finance baseline: `65,000 gas * 0.006 gwei + 2,904,491,386 wei L1 fee = $0.001071` per transfer.
- At `40,000` transfers/day, that baseline is `$42.85/day` or `$1,285.44/30 days`.

Cost formula: `(gasUsed * effectiveGasPriceWei + l1FeeWei) / 1e18 * ETH_USD`.

Base fee model note: Base transactions pay both L2 execution fee and L1 data/security fee. Base currently has a `5,000,000 wei` minimum base fee and exposes L1 fee estimation through the GasPriceOracle predeploy. See Base network fee docs: https://basehub.org/network/network-fees/

## Ranked Changes

| Rank | Change | Savings at current Base fees | When it matters | Shipped code |
| --- | --- | ---: | --- | --- |
| 1 | Enforce live EIP-1559 fees and reject stale fixed `gasPrice` | If we are accidentally sending at `1 gwei`, saves about `$7,046/day` and `$211k/30 days`. If we already use live RPC fees, steady-state savings is `$0` but it prevents outlier over-tips. | Highest-risk check because old Base/mainnet defaults like `1 gwei` are ~167x today’s `0.006 gwei` RPC price. | `src/feePolicy.mjs` |
| 2 | Batch ERC-20 payouts in contract-funded batches of 100 | About `$10.89/day`, `$326.84/30 days`, or `25.4%` of the conservative baseline. | Good steady-state saver if we can fund a batch contract and accept contract review/ops risk. | `contracts/Erc20BatchRelayer.sol`, `src/gasMath.mjs` |
| 3 | Coalesce same `(chain, token, recipient)` payments before sending | Every `10%` fewer transfers saves about `$4.28/day` and `$128.54/30 days`; `25%` fewer saves `$10.71/day` and `$321.36/30 days`. | Best if customers receive multiple same-token payments inside a short settlement window. Measure actual duplicate rate before setting the window. | `src/coalesceTransfers.mjs` |
| 4 | Defer flexible payments during execution-fee spikes | If `5%` of daily transfers would otherwise pay `0.081 gwei`, capping at `0.02 gwei` saves about `$21.62/day` during that condition. Quiet-day savings is `$0`. | Useful for non-urgent payouts; urgent payouts should bypass with explicit flag. | `src/feePolicy.mjs` |
| 5 | Give Finance a live gas report instead of static estimates | No direct gas savings. Prevents budgeting against obsolete 2021-2023 gas assumptions. | Run daily or hourly and persist output beside relayer spend metrics. | `scripts/base-gas-report.mjs` |

## What To Ship

1. Add `buildBaseFeeOverrides` to the relayer send path.

Use `buildBaseFeeOverrides({ baseFeeWei, priorityFeeWei })` from `src/feePolicy.mjs` when constructing transactions. Current default cap is `0.02 gwei`, roughly `3.3x` the current Base `eth_gasPrice`. Non-urgent payments should not submit above that cap; urgent payments can pass `urgent: true`.

Also call `rejectLegacyGasPrice` anywhere a legacy `gasPrice` override enters the system. This catches stale fixed settings like `1 gwei`, which would move spend from `$42.85/day` to `$7,088.88/day`.

2. Coalesce before nonce assignment.

Use `coalesceTransfers(transfers)` on queued payments before assigning nonces or signing. It only merges exact same chain, token, and recipient, preserves source ids, and returns summed integer amounts as strings.

3. Pilot batching after review.

`contracts/Erc20BatchRelayer.sol` is intentionally small: owner-only, no upgradeability, no arbitrary calls, safe ERC-20 return handling, and an owner rescue function. It expects the contract to hold the ERC-20 balance. Do not use `transferFrom` from the relayer wallet as the default batching path until it is benchmarked, because allowance checks can erase much of the gas saving.

Suggested rollout:

- Deploy to Base Sepolia.
- Benchmark `batchTransfer` for your real token at batch sizes `25`, `50`, `100`, and `200`.
- Pick the largest batch that stays comfortably below operational latency and block gas limits.
- Fund the contract only with the next settlement window’s required token amount.

4. Automate reporting.

Run:

```bash
npm run gas:report
```

Useful overrides:

```bash
BASE_RPC_URL=https://mainnet.base.org TOKEN_ADDRESS=<erc20> TRANSFERS_PER_DAY=40000 SAMPLE_LIMIT=20 npm run gas:report
```

## Implemented Files

- `src/gasMath.mjs`: shared gas cost math and savings estimators.
- `src/baseGasData.mjs`: Base RPC, ETH/USD, recent transfer sampling, and baseline calculations.
- `src/feePolicy.mjs`: relayer fee cap and stale legacy gas-price rejection.
- `src/coalesceTransfers.mjs`: same-recipient transfer coalescing.
- `scripts/base-gas-report.mjs`: live JSON report for Finance and ops.
- `contracts/Erc20BatchRelayer.sol`: contract-funded ERC-20 batch payouts.
- `test/*.test.mjs`: coverage for math, coalescing, and fee policy.

## Verification

```bash
npm test
SAMPLE_LIMIT=12 npm run gas:report
```

Both commands passed on 2026-09-23.
