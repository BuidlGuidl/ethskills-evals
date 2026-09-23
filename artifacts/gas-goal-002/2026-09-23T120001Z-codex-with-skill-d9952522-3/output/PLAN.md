# Base ERC-20 Gas Plan

Measured on 2026-09-23 UTC against Base. Current live inputs:

- Base `eth_gasPrice`: `6,000,000 wei` (`0.006 gwei`)
- Base latest block `baseFeePerGas`: `5,000,000 wei` (`0.005 gwei`)
- ETH/USD: `$2,723.79`
- Workload: `40,000` ERC-20 transfers/day
- Receipt sample: 5 recent Base USDC plain `transfer(address,uint256)` receipts
- Sample p50 transfer: `62,159` gas used plus `3,200,078,658 wei` L1 fee

Baseline spend:

- Per transfer: `(62,159 * 6,000,000 + 3,200,078,658) wei = 376,154,078,658 wei = 0.000000376154 ETH`
- Per transfer in USD: about `$0.001025`
- Daily: about `$40.98`
- 30 days: about `$1,229.48`
- Annual: about `$14,958.64`

## Ranked Changes

| Rank | Change | Savings at current measured fees | What shipped |
| --- | --- | ---: | --- |
| 1 | Stop priority-fee overpay by deriving Base EIP-1559 fields immediately before submission | Relayer-dependent. If all transfers paid `0.015975 gwei` like the high sample receipt, savings are about `$67.55/day` and `$24,657/year`. If the relayer already pays `0.006 gwei`, savings are `$0`. The 5-receipt public sample would save `$12.17/day` if normalized to `0.006 gwei`. | `buildBaseFeePolicy()` in `src/baseGasMath.mjs`; CLI prints `maxFeePerGas=11,000,000 wei`, `maxPriorityFeePerGas=1,000,000 wei` from the live readings. |
| 2 | Batch same-token payouts through a funded batch contract | About `$11.99/day`, `$359.72/30d`, `$4,376.56/year`, or `29.3%` versus the measured direct-transfer baseline. | `contracts/BatchERC20Transfers.sol` with `batchTransfer()` and `batchTransferFrom()`. Prefer `batchTransfer()` with the contract pre-funded; keep `batchTransferFrom()` for migration or treasury-wallet custody constraints. |
| 3 | Feed actual relayer hashes into gas accounting every day | No gas saved directly; saves finance/reconciliation time and catches fee regressions. It turns the relayer-dependent row above into an exact dollar number. | `npm run cost:base`; pass `SAMPLE_TX_HASHES=hash1,hash2,...` for known relayer txs or `TOKEN_ADDRESS`/`BASE_RPC_URL` for live sampling. |

## Batching Math

Direct measured p50:

```text
execution = 62,159 gas * 6,000,000 wei = 372,954,000,000 wei
l1 fee    = 3,200,078,658 wei
total     = 376,154,078,658 wei = $0.001025/transfer
daily     = 40,000 * $0.001025 = $40.98/day
```

Batched estimate used by the CLI:

```text
execution = 44,000 gas * 6,000,000 wei = 264,000,000,000 wei
l1 fee    = 2,100,000,000 wei
total     = 266,100,000,000 wei = $0.000725/transfer
daily     = 40,000 * $0.000725 = $28.99/day
savings   = $40.98 - $28.99 = $11.99/day
```

The local Foundry gas report for the batch contract shows `batchTransfer()` at `78,917` gas for a 2-recipient mock ERC-20 batch, versus roughly `124,318` gas for two measured direct Base transfers before any L1 amortization. Before production deployment, run a fork/staging gas report using the exact token and a realistic batch size such as 50, 100, or 250 recipients.

## Shipping Notes

1. Wire the relayer fee builder to use live Base readings:

```js
const { maxFeePerGas, maxPriorityFeePerGas } = buildBaseFeePolicy({
  baseFeeWei,
  gasPriceWei
});
```

At the measured fee level this produces:

```text
maxFeePerGas = 11,000,000 wei
maxPriorityFeePerGas = 1,000,000 wei
```

2. Deploy `BatchERC20Transfers` with the relayer/ops multisig as `owner`.

3. Prefer the funded flow:

```text
treasury funds BatchERC20Transfers once per cycle
relayer calls batchTransfer(token, payments)
```

This avoids per-recipient allowance accounting. If custody requires the treasury wallet to keep the funds, use `batchTransferFrom()` with an allowance, but re-measure because it will be a little more expensive.

4. Add the accounting job:

```bash
SAMPLE_TX_HASHES=0xabc...,0xdef... npm run cost:base
```

For log sampling instead of known hashes:

```bash
BASE_RPC_URL=https://mainnet.base.org TOKEN_ADDRESS=0x833589fcd6edb6e08f4c7c32d4f71b54bdA02913 npm run cost:base
```

Public RPCs may rate-limit `eth_getLogs`; using known relayer transaction hashes is more reliable and gives finance the exact wallet-specific answer.
