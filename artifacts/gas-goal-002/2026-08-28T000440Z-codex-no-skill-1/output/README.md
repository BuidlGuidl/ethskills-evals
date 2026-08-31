# Base payment gas controls

`scripts/gas-report.mjs` reports *actual* Base fees from completed relayer transaction receipts. Give it the transaction hashes for a representative 7-30 day period; it separately totals L2 execution, L1 data/security, and operator fees when the RPC exposes them.

```bash
BASE_RPC_URL=https://your-base-rpc.example node scripts/gas-report.mjs tx-hashes.txt
node scripts/estimate-batch-savings.mjs 40000 51000 35000 200
```

`contracts/BatchERC20Distributor.sol` is the deployable batching primitive. The relayer first approves the deployed distributor for the required token amount, then calls `batchTransferFrom(token, recipients, amounts)`. Start at 50 recipients, simulate and `eth_estimateGas` against the exact token and payload, then raise toward the 200-recipient safety cap only if latency and gas limits remain comfortable. Use a reviewed deployment pipeline and an independent audit before production custody/allowance changes.
