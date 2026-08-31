# Base relayer gas plan

## Bottom line

At 40,000 payments/day, this is 1.2 million transfers in a 30-day month and
14.6 million/year.  There is no relayer address or historical receipt export in
this repository, so an exact historical total cannot be reconstructed here.
The live measurements below are a transparent current-rate estimate, not a
claim about the app's past spend.  `src/baseFees.js` is included to turn the
relayer's real receipts into the finance number; it includes both execution and
Base's `l1Fee`.

### Live measurement (2026-08-27)

Inputs read directly from `https://mainnet.base.org` and Coinbase's ETH/USD spot
endpoint during this work:

| Input | Value |
| --- | ---: |
| Base latest `baseFeePerGas` | 5,000,000 wei (0.005 gwei) |
| Base `eth_gasPrice` | 6,000,000 wei (0.006 gwei) |
| ETH/USD spot | $2,516.785 |
| Sample direct USDC `transfer` | 45,071 gas; 6,549,540 wei effective gas price; 572,940,938 wei L1 fee |
| Second direct USDC `transfer` | 45,589 gas; 6,000,000 wei effective gas price; 652,235,391 wei L1 fee |

For the first transfer, the calculation is:

`(45,071 × 6,549,540 + 572,940,938) wei × $2,516.785 / 1e18 = $0.00074438`.

The two samples produce a **$0.000690–$0.000744 per-payment** range:

| Period | Current-rate estimate |
| --- | ---: |
| Day | $27.60–$29.78 |
| 30-day month | $828–$893 |
| Year | $10,075–$10,868 |

Both receipts expose `l1Fee`; it is only $0.0000014–$0.0000016/payment here
(about 0.2% of total).  Re-check it from the application's receipts before
making any calldata-specific decision: it changes with Base and L1 conditions.

## Ranked changes

Savings are annualized at 14.6m payments/year and the measured $0.000690–
$0.000744 rate.  “Conditional” means the exact saving depends on a fact not
available in this repository.

| Rank | Change | Measured/modelled saving | Status |
| ---: | --- | ---: | --- |
| 1 | Send same-token payments in funded batches | **About 30–40% of total: $3,022–$4,347/year** (about $252–$362/month) | Implemented; rollout and audit required |
| 2 | Use a live Base EIP-1559 quote at signing, never a fixed fee | **$0 if already using the RPC quote.** If the relayer pins 0.1 gwei, the current execution portion would fall by about $145k/year, before any inclusion/replacement effects. | Implemented |
| 3 | Eliminate retries/duplicates and report them separately | **Exactly current average fee × avoided sends:** $0.000690–$0.000744 each; e.g. 1% avoided = **$101–$109/year** | Instrument first |
| 4 | Calldata compression/micro-optimisation | At most the measured L1 component: **$20–$23/year** if it could be removed entirely; it cannot. | Do not prioritize |

### 1. Batch payments by token

The shipped `BatchERC20Relayer` makes one owner-authorized call distribute one
token to many recipients.  It is deliberately funded in advance: using
`transferFrom` for every recipient would add allowance work and undermine the
saving.  The conservative 30–40% model comes from eliminating 49 of every 50
transaction base costs while retaining each ERC-20 balance update.  A local
two-recipient execution run consumed 82,955 gas for `batchTransfer`; production
savings must be confirmed on Base with the actual token(s), recipient state,
batch size, and calldata fee.

Operational constraints:

1. Batch only payments that may settle together.  A failed token transfer
reverts the whole batch, so pre-validate balance and recipient queues.
2. Start with 25–50 transfers per token/transaction, estimate gas, then tune;
the contract caps a batch at 200 to prevent accidental unbounded calls.
3. The distributor becomes a token custodian. Deploy from the existing relayer
operator/multisig, fund it in controlled tranches, and obtain a security review
before production.  Two-step ownership and a token rescue function are present.
4. Run a small Base pilot and compare actual `gasUsed * effectiveGasPrice +
l1Fee` per successful payment against direct sends before broad rollout.

### 2. Set fees from Base immediately before signing

`baseFeeFields(provider)` derives priority fee from Base's live `getGasPrice()`
and latest base fee.  Its `maxFeePerGas` is a cap for the next block, not the
amount charged.  Do not copy a mainnet tip or a fixed Base fee into configuration.
On congestion/replacement, fetch again; do not mechanically multiply stale
fees.

The $145k conditional figure uses the sample's 45,071 execution gas, compares
0.1 gwei with 0.00655 gwei, and intentionally excludes L1 fee (which is
unaffected): `(0.1 - 0.00655) gwei × 45,071 × 14.6m × $2,516.785 / 1e9`.
It is not a forecast unless the production relayer really pins 0.1 gwei.

### 3. Make the finance report exact

For each mined relayer receipt, record `gasUsed`, `effectiveGasPrice`, `l1Fee`,
token, submission type (direct/batch), and payment count.  Calculate total
wei as `gasUsed × effectiveGasPrice + l1Fee`; divide a batch's total by its
successful payment count.  `summarizeReceipts` implements this arithmetic and
avoids silently omitting L1 data fees.  Maintain daily p50/p95 and a retry
counter; this establishes whether any next optimisation is real.

## Shippable code

- `contracts/BatchERC20Relayer.sol`: owner-only funded ERC-20 distributor,
  bounded batches, safe handling of ERC-20s that return no value, ownership
  handoff, and emergency token recovery.
- `src/baseFees.js`: live EIP-1559 fee fields plus OP-stack receipt accounting.
- `test/`: unit tests for payment authorization, input validation, and fee arithmetic.

Run all checks with `npm test`.  Deployment is intentionally not automated:
it requires the production owner address, a reviewed custody decision, and a
Base pilot transaction.
