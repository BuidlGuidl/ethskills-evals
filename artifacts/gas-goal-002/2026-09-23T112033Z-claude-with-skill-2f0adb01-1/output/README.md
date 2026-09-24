# Base relayer gas

See [PLAN.md](./PLAN.md) for the cost analysis and ranked recommendations.

| Path | What it is |
|---|---|
| `relayer/audit-relayer-spend.mjs` | What the relayer really paid, from its own receipts. **Run this first.** |
| `relayer/feeStrategy.mjs` | Fee/tip selection that tracks the chain instead of a hardcoded constant |
| `relayer/batchClient.mjs` | Queue that batches payouts by size or timeout |
| `src/BatchTransfer.sol` | Batched ERC-20 fan-out, relayer-only, atomic |
| `script/DeployBatchTransfer.s.sol` | Deployment |
| `scripts/gas-cost-report.mjs` | Live cost model for every option in the plan |
| `test/GasBenchmark.t.sol` | Fork benchmark backing the batching numbers |

```bash
npm run report              # live cost model
RELAYER=0x... npm run audit # real relayer spend
npm test                    # fee strategy tests
BASE_RPC_URL=https://mainnet.base.org npm run test:gas
```
