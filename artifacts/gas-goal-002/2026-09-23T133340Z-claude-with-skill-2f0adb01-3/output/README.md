# Base payments relayer — gas cost work

**Start with [PLAN.md](PLAN.md)** — the cost analysis, the ranked recommendations,
and the numbers behind each one.

## Quick start

```bash
# What we spend on gas, at live prices
node tools/gas-report.mjs

# ...including real historical spend from the relayer's own transactions
BASESCAN_API_KEY=... node tools/gas-report.mjs --relayer 0xYOUR_RELAYER --days 30

# Reproduce the gas measurements behind the plan
export BASE_RPC_URL=https://mainnet.base.org
forge test --match-path test/GasBenchmark.t.sol -vv --threads 1

# Contract safety tests (no network needed)
forge test --no-match-path 'test/GasBenchmark.t.sol'
```

The benchmark's `test_BaselineMatchesObservedOnchainGas` pins the model to real
Base receipts. If it starts failing, the figures in PLAN.md need re-deriving.

## Layout

| Path | What it is |
|---|---|
| `src/BatchPay.sol` | Batching contract: packed calldata, relayer allowlist, atomic batches |
| `tools/batch.mjs` | Relayer-side encoder, chunking, failure bisect, fee overrides |
| `tools/gas-report.mjs` | Cost report for Finance |
| `test/BatchPay.t.sol` | Access control, atomicity, decode-bound tests |
| `test/GasBenchmark.t.sol` | Fork benchmarks vs. real USDC |
| `test/CrossCheck.t.sol` | JS encoder output decoded by the contract |
| `tools/gen-crosscheck.mjs` | Regenerates the golden calldata for the cross-check |
| `script/Deploy.s.sol` | Deployment |

Deployment prerequisites and the failure modes to handle are in the last section
of PLAN.md — read them before shipping `BatchPay`.
