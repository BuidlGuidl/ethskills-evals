# Base relayer gas plan

Generated from this workspace on 2026-09-23. The numbers below use:

- Chain: Base mainnet
- Volume: 40,000 ERC-20 `transfer` transactions/day, 1,200,000/month
- ETH/USD: $2,733.79 from CoinGecko during the run
- Live Base fee snapshot: latest sampled block 51,686,374, base fee 0.005000 gwei, gas price 0.006000 gwei
- Receipt sample: 10 recent successful ERC-20 `transfer` transactions on Base
- Observed average transfer: 43,746 gas, 0.005987 gwei effective gas price, 2.6843e-7 ETH all-in including `l1Fee`

## Current spend

Observed all-in gas cost:

```text
2.6843e-7 ETH/transfer * $2,733.79/ETH = $0.000733/transfer
$0.000733 * 40,000/day = $29.34/day
$29.34/day * 30 = $880/month
$29.34/day * 365 = $10,709/year
```

The deterministic live-fee estimator is close: using 45,576 execution gas, 0.006 gwei gas price, and 3.0364e-9 ETH L1 data fee gives about $907/month. Use the observed receipt path for accounting once we point it at our relayer address.

## Ranked changes

| Rank | Change | Expected savings | Why |
| --- | --- | ---: | --- |
| 1 | Cap relayer fees to Base reality and alert on overpay | $0/month if we already pay RPC gas price; about $14,300/month if we currently pay a 0.1 gwei priority fee; about $143,500/month if we pay a 1 gwei priority fee | Base is clearing around 0.006 gwei now. Old defaults like 0.1-1 gwei priority fees dominate the whole bill. This is the biggest possible leak to verify first. |
| 2 | Reduce transfers by netting/coalescing | 10% fewer = $88/month; 25% fewer = $220/month; 50% fewer = $440/month | Gas spend is now mostly linear with transaction count. Same token+recipient payouts inside a short settlement window should be summed before the relayer signs. |
| 3 | Batch payouts from a contract-held balance | 20-30% of current spend = $176-$264/month | A batch can amortize the 21k intrinsic transaction gas across many recipients, but it adds contract custody, deployment, monitoring, and audit risk. Worth doing only if operational batching is already desired. |
| 4 | Defer non-urgent payments during Base fee spikes | Normally near $0; useful as a guardrail during rare spikes | Current base fee is 0.005 gwei. Deferring matters only when Base is temporarily much higher, so this is an availability/SLO policy more than a steady-state savings lever. |
| 5 | Move chains | Not recommended for gas savings | We are already on Base. The current bill is under $1k/month at 40k transfers/day, so migration risk is larger than the gas win unless there is a product reason. |

## Code implemented

1. `src/baseGas.js`
   - Fetches live Base fee data.
   - Estimates the L1 data fee through Base's `GasPriceOracle`.
   - Samples recent ERC-20 transfer receipts and includes `l1Fee`.
   - Builds conservative EIP-1559 fee caps for the relayer.

2. `bin/base-gas-report.js`
   - CLI for finance/ops reporting.
   - Run:

```bash
npm run gas:report -- --sample 25
```

   - For machine-readable output:

```bash
npm run gas:report -- --sample 25 --json
```

   - Once we have production values, run with a private RPC and the same volume:

```bash
BASE_RPC_URL="$BASE_RPC_URL" npm run gas:report -- --transfers-per-day 40000 --sample 100
```

3. `src/transferPlanning.js`
   - Coalesces same token+recipient transfers by summing amounts.
   - Chunks transfer lists into fixed-size batches for relayer queues or future batch contracts.
   - Returns exact skipped-transfer savings when given a per-transfer cost.

## Relayer fee policy to ship

Use the output of `buildBaseRelayerFeePolicy()` for Base transactions:

```text
current recommended maxFeePerGas: 0.016000 gwei
current recommended maxPriorityFeePerGas: 0.001000 gwei
defer non-urgent payments when Base baseFee > 0.05 gwei
```

These are caps, not target spend. With EIP-1559 we pay the actual Base fee plus priority fee, so the cap protects inclusion without volunteering a 0.1-1 gwei tip.

## Rollout

1. Add the gas report to the daily finance job and store JSON output.
2. Wire `buildBaseRelayerFeePolicy()` into the relayer transaction builder.
3. Add an overpay alert when actual receipt `effectiveGasPrice` is more than 3x the live Base `eth_gasPrice` for the same window.
4. Add `coalesceTransfers()` before signing payments for settlement windows where combining payouts does not change user-visible semantics.
5. Revisit batch-contract payouts only after measuring duplicate rate and after a custody/security review.

## Validation

Tests:

```bash
npm test
```

Live report run:

```bash
npm run gas:report -- --sample 10
```

Result: $29.34/day, $880/month, $10,709/year at the sampled 2026-09-23 Base fee environment.
