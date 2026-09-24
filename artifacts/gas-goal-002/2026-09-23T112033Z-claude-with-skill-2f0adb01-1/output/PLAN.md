# Base relayer gas: what we spend, and what to do about it

**Measured 2026-09-23.** ETH $2,721. Base L2 base fee 0.005 gwei, sequencer
suggested price 0.006 gwei. All figures below come from live chain data, not
estimates — reproduce any of them with `npm run report` and `npm run audit`.

---

## The headline for Finance

**We spend roughly $1,000/month — about $12,100/year — on gas.**

At 40,000 ERC-20 transfers/day:

| | Gas | Cost each | Per day | Per year |
|---|---|---|---|---|
| Repeat recipient | 43,000 | $0.00071 | | |
| First-time recipient | 62,171 | $0.00102 | | |
| **Blended (38% first-time)** | **50,285** | **$0.00083** | **$33** | **$12,100** |

Two things follow from that number, and they point in opposite directions:

1. Gas is not a meaningful cost line for this business. It is ~0.08 cents per
   payment. Every optimisation below is worth less than one engineer-month.
2. That is exactly why it deserves one day of attention, not a project. The
   risk is not that we are spending $12k — it is that a one-line
   misconfiguration could make us spend $2M and nobody would notice, because
   nobody is looking at this number.

Item 1 below is that check. **Do it before funding anything else here.**

### Where the money actually goes

- **L2 execution: 99.0%** of each transfer
- **L1 data availability: 1.0%** ($0.0000085 per transfer)

This is the single most important structural fact, and it inverts the usual
advice. Post-EIP-4844 blob pricing has made L1 data essentially free
(blob base fee is currently 0.02 gwei). **Anything that optimises calldata size
is optimising 1% of the bill.** The only lever that matters is executing fewer
gas units — i.e. fewer transactions.

---

## Ranked actions

### 1. Verify what we actually pay per gas unit — *saving: $0 to ~$2,000,000/yr*

**Effort: 1 hour. Do this first.** Everything below assumes we pay the going
rate of ~0.006 gwei. We have not confirmed that.

The most common and most expensive bug in an L2 relayer is a hardcoded priority
fee carried over from mainnet-era defaults. The arithmetic:

| Tip setting | Cost per transfer | Per year at 40k/day |
|---|---|---|
| Tracking the chain (0.001 gwei) | $0.00083 | $12,100 |
| Hardcoded 1 gwei | $0.14 | **$2,000,000** |

That is a **167x** difference from one constant, and it produces no error, no
failed transaction, and no alert. It just quietly drains the relayer wallet.

Run this against the live relayer wallet:

```bash
RELAYER=0xOurRelayerAddress npm run audit
```

It reads real receipts and reports the effective gas price, the tip actually
paid, the true extrapolated annual spend, and the revert rate. It ends with a
verdict telling you whether we are overpaying.

**Shipped:** `relayer/audit-relayer-spend.mjs`, and `relayer/feeStrategy.mjs`
which fixes it. The fee module clamps the tip into a sane band and tracks
`eth_maxPriorityFeePerGas`:
- The ceiling alone (0.05 gwei) cuts a stray 1 gwei constant by **18x**.
- Tracking the live suggestion cuts it by **167x**.
- It refuses to send above 50 gwei total rather than paying through a spike.
- `maxFeePerGas` carries 3x headroom on base fee. Unused headroom is refunded —
  a cap is not a price — so the headroom costs nothing and avoids stuck txs.

Both behaviours are unit-tested in `relayer/feeStrategy.test.mjs` (`npm test`).

### 2. Batch the transfers — *saving: ~$6,700/yr (55%)*

**Effort: 1–2 weeks including audit and rollout.** This is the only real
engineering lever, and its payback is ~1 engineer-week per year of savings.
Ship it if we want the operational benefits (fewer nonces, fewer receipts to
track, less relayer contention); the gas saving alone does not justify it.

One transaction per payout means paying the 21,000 gas intrinsic cost 40,000
times a day. Batching amortises that over the whole batch.

Measured on a Base fork against real USDC (`test/GasBenchmark.t.sol`):

| Batch size | Gas per payout | Cost per payout | Annual saving |
|---|---|---|---|
| 1 (today) | 50,285 | $0.00083 | — |
| 10 | 29,367 | $0.00048 | $5,060 (42%) |
| 25 | 24,867 | $0.00041 | $6,138 (51%) |
| 50 | 23,367 | $0.00039 | $6,497 (54%) |
| **100** | **22,617** | **$0.00037** | **$6,677 (55%)** |
| 200 | 22,242 | $0.00037 | $6,767 (56%) |

**Returns flatten past 100.** Going from 100 to 200 buys another $90/year while
doubling the latency a payout waits and doubling the blast radius of a failed
batch. **Recommend batch size 100.**

At 40,000/day (~28/min) a batch of 100 fills in ~3.6 minutes, so the real
latency knob is `maxWaitMs`, not batch size. A 60s cap bounds worst-case delay
while still filling most batches.

**Shipped:**
- `src/BatchTransfer.sol` — pulls from the relayer via `transferFrom` and fans
  out. Tokens move payer → recipient directly; the contract never custodies a
  balance. Restricted to the relayer address. Atomic: any failed leg reverts the
  whole batch, so there is never a partially-applied run to reconcile.
- `relayer/batchClient.mjs` — a queue that flushes on size or timeout, and
  auto-selects the cheaper uniform-amount path.
- `script/DeployBatchTransfer.s.sol` — deployment.

**Operational note:** the relayer must approve BatchTransfer on the payout
token. Approve a bounded amount sized to a few days of volume and top it up.
Do not grant an unlimited allowance — it converts a relayer key compromise into
a treasury drain. This contract should get a review before it holds allowance;
that review, not the code, is the long pole on this item.

### 3. Check the revert rate — *saving: unknown until measured, potentially large*

A reverted transaction burns its full gas and delivers nothing, and the payout
gets retried — so we pay twice. This is invisible in a "total gas spent" figure.

The audit script in item 1 reports this. It is worth calling out because when I
pointed the script at a random high-volume Base sender as a test, **100% of its
transactions were reverting** — that address is burning ~$100k/year on failed
transactions. That is a real failure mode, not a hypothetical.

If our revert rate is above a few percent, fixing it likely beats item 2 for
less work: pre-flight balance and allowance checks before sending.

### 4. Use uniform-amount batches where payouts are equal — *saving: ~$150/yr*

`batchTransferSameAmount` drops one calldata word per recipient (14,401 vs
15,439 marginal gas). Already implemented and selected automatically by
`batchClient.mjs` when all amounts in a batch match. Listed for completeness —
it is rounding error, and no work is required.

---

## Explicitly not worth doing

**Calldata compression / address registries with uint32 indices.** A classic
L2 optimisation that is now obsolete. It targets the L1 data fee, which is
**1.0%** of our cost — about $120/year in total. Even perfect compression
cannot save more than that, and it would add an indirection layer to every
payout. Skip.

**Moving to another chain.** We are already on the cheapest tier. Base at
$0.00083/transfer is competitive with every major L2; mainnet would be roughly
15–20x more. There is nothing to win and a migration to lose.

**Gas tokens / refund schemes.** Dead since EIP-3529 removed the refunds these
relied on.

**Waiting for cheaper gas.** Base's base fee is 0.005 gwei and has effectively
no diurnal pattern worth scheduling around. Timing logic would add complexity
and latency to save cents.

---

## Reproducing these numbers

```bash
npm run report                          # live cost model, all scenarios
RELAYER=0x... npm run audit             # what the relayer really paid
npm test                                # fee strategy unit tests
BASE_RPC_URL=https://mainnet.base.org npm run test:gas   # batching gas benchmark
```

### Method notes

- **Baseline gas is observed, not estimated.** Sampled 40 real USDC transfers on
  Base from recent blocks. The distribution is bimodal: 40,259–45,059 gas for
  recipients who already hold the token, 62,171 for first-time recipients. The
  ~20,000 gas gap is the EVM's zero → non-zero storage write. 38% of the sample
  were first-time recipients; **that share is the least certain input here** —
  it is from public traffic, not our payment mix. A recurring payments app
  likely skews more toward repeat payees, which makes both the baseline and the
  saving somewhat smaller. Override it: `NEW_RECIPIENT_SHARE=0.15 npm run report`.
- **Batch gas is measured as a marginal cost.** A forge harness adds a fixed
  ~25k overhead versus a real EOA transaction. Reporting the slope between two
  batch sizes cancels that constant out exactly, so the per-payout figures are
  not inflated by the test setup.
- Prices move. The model reads the chain live rather than hardcoding, so rerun
  it rather than trusting this document's absolute dollar figures in a month.
