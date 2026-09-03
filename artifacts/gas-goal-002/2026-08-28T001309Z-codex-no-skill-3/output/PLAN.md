# Base relayer gas plan

## Baseline and measurement

We cannot truthfully state the current spend from the transfer count alone: Base charges an L2 execution fee **and** an L1 data fee, both variable. At 40,000 payments/day, every 1 micro-ETH (`0.000001 ETH`) of all-in fee per payment is `0.04 ETH/day`, `1.2 ETH/30-day month`, and `14.6 ETH/year`.

Run the included report against the relayer before approving a change:

```sh
BASE_RPC_URL=<Base RPC with OP receipt extensions> RELAYER=0x... TOKEN=0x... npm run gas:report -- 2026-08-01 2026-08-08
```

It finds `Transfer` events whose `from` is the relayer, deduplicates their transaction hashes, and totals `gasUsed × effectiveGasPrice + l1Fee + operatorFee` as `BigInt`. After batch rollout, add `PAYOUT_SENDER=<disburser address>` because the events then originate from the disburser while the owner still pays the gas. `l1Fee` is mandatory for an actual all-in number; if the RPC omits it, the tool explicitly reports a lower bound. Divide the known total by payout logs, then multiply by 40,000 and 30 for the daily and monthly finance run rate. Include funding, failed, replacement, approval, and non-payment relayer transactions in the general-ledger reconciliation; this report is intentionally the payout cohort.

The worked example below is an assumption-led sensitivity model, **not a claim about our historical spend**: 50,000 L2 gas per standard transfer, Base's 0.005 gwei minimum base fee, and 0.00000120 ETH of L1 data fee per signed payment. It produces `0.00000145 ETH/payment`, or `0.058 ETH/day`, `1.74 ETH/30-day month`, and `21.17 ETH/year`. Dollar amounts should use Finance's ETH price at reporting time; at $2,300/ETH that is about $133/day and $48.7k/year.

## Ranked actions by expected savings

| Rank | Change | Savings model at 40k/day | Confidence / decision gate |
|---|---|---:|---|
| 1 | Batch payments of the same ERC-20 into 50–200 payouts/transaction using the included disburser. | Model a 100-item batch at 30,000 L2 gas and 0.00000020 ETH L1 data **per payout**: `(0.00000015 + 0.00000020) × 40,000 = 0.014 ETH/day`. Saving vs baseline: **0.044 ETH/day, 1.32 ETH/month, 16.1 ETH/year (76%)**. | Measure ten representative batches versus ten normal payments per token. Contract custody and token compatibility are the real trade-offs. |
| 2 | Use a batching queue with a bounded service-level agreement: group by token, dispatch on 100 recipients or a maximum delay, and submit only confirmed batches. | This enables rank 1; its incremental network saving is the difference between the actual fill rate and 100. At 50/payments-batch, the fixed transaction costs are roughly twice the 100-item case, so expect somewhat less than the 76% model saving. | Product must approve the payment-delay ceiling. Do not delay urgent/merchant-settlement transfers. |
| 3 | Remove unnecessary priority fee and stop blind replacement transactions; use EIP-1559 `maxFeePerGas` as a safety cap, not a spend target. | Savings are exactly `payments × avoided tip` plus fees on avoided failed/replaced transactions. A 0.001 gwei avoided tip on a 50k-gas payout is `0.00000005 ETH`; at volume that is **0.002 ETH/day / 0.06 ETH/month**. | Inspect current submitted fee fields and replacement count in the first report/export. A fee cap alone does not reduce the effective price paid. |
| 4 | Fund the disburser in larger per-token tranches; eliminate repeated approvals and avoid zeroing/re-setting allowances. | A one-time token transfer into the disburser adds cost, while repeated approvals are pure avoidable spend. `avoided approval count × actual all-in approval fee` is the saving. | Do this only with the batch contract and a balance/reconciliation alert. Never use infinite approval to an unreviewed contract. |
| 5 | Schedule non-urgent batches when L1 data costs are lower, with a hard deadline and fee ceiling. | The saving is `observed L1-fee reduction × payouts`. If L1 data is 0.00000120 ETH and the selected window is 25% cheaper, that is **0.012 ETH/day / 0.36 ETH/month**. | Base documents that L1 data cost varies with Ethereum conditions. Backtest our own receipt `l1Fee` by hour/day before promising a percentage. |

## Shippable implementation: batch disburser

`contracts/ERC20BatchDisburser.sol` is a small, dependency-free Solidity `^0.8.20` contract. The relayer (ideally a multisig/policy-controlled owner) transfers a token balance into the contract, then calls `disburse(token, recipients, amounts)`. It limits a batch to 200, validates array lengths and recipients, uses checks-effects-interactions protection, and safely handles ERC-20s that return either `true` or no value.

Deployment and rollout requirements:

1. Compile and test against every production token, including a recipient with an existing balance and one with a zero balance; fee-on-transfer/rebasing tokens are excluded unless short-payments are accepted.
2. Deploy with the production multisig as `initialOwner`; verify bytecode; transfer one small funding amount; execute a 2-recipient canary; reconcile token balance, transfer logs, and gas receipt.
3. Start at 25 payouts/batch, then 50, 100, and only increase if `estimateGas` plus measured L1 fee remains below the per-payment control limit. Keep a per-token ledger of funded balance, queued sum, submitted sum, and confirmed sum.
4. Keep the direct-transfer path as a fallback. Do not mark payouts paid until the batch receipt has succeeded and its transfer events match the exact queued recipients and amounts.

## Controls and targets

- Finance dashboard: daily all-in ETH and USD, payment count, ETH/payment (p50/p95), L2/L1/operator fee split, batch fill rate, failed/replaced transaction count, and funding/approval cost.
- Alert when an estimated batch exceeds the rolling p95 ETH/payment by 25%, any receipt lacks a required expected `Transfer`, a batch reverts, or the disburser balance drops below queued obligations.
- The contract is an operational optimization, not a way to reduce the gas charged by the ERC-20 token itself. The savings come from sharing transaction envelope, intrinsic gas, and L1 data overhead across recipients.

Base documents the two-part fee model and its Gas Price Oracle at [Base network fees](https://docs.base.org/base-chain/network-information/network-fees). The L2 fee floor used in the illustrative model is the documented current 0.005 gwei minimum; use actual receipts rather than this model for budgets.
