# Gas plan — Base payments relayer (~40,000 ERC-20 transfers/day)

All numbers below were measured live on Base mainnet on 2026-09-23 (fork tests
against real USDC, plus real on-chain receipts), at ETH ≈ $2,723.

## Bottom line

We currently spend roughly **$0.001 per payment ≈ $40/day ≈ $1,200/month
(~$14.5k/year, ~5.3 ETH/year)**. Batch transfers plus sane fee settings can
cut that to about **$16/day ≈ $500/month** — a **~60% reduction** — with no
latency change for the majority of payments.

| # | Change | Savings (measured) | $/month | Status |
|---|--------|-------------------|---------|--------|
| 1 | **Batch payments via `BatchTokenTransfer.sol`** (~20 payments/tx) | 64% of all L2 execution gas | **~$680–770** | code shipped |
| 2 | **EIP-1559 fee policy with hard caps** (`src/fees.ts`) | eliminates up to 38x tip overpay observed live; realistically 5–25% depending on current config | ~$60–300 (avoided overpay) | code shipped |
| 3 | **Spike backoff for non-urgent payments** (same module) | guards against base-fee spikes; converts worst minutes from 30x cost to queued | risk/insurance | code shipped |
| 4 | **L1 data amortization** (from batching) | ~$0.25–0.45/day at current blob prices; real value is insurance when blob fees spike | ~$10 | automatic with #1 |
| 5 | **Actual-spend ledger + report** (`ledger.ts`, `scripts/gas-report.ts`) | n/a — answers finance's question with on-chain receipts, not estimates | — | code shipped |

## Measured baseline (what we pay today)

Sample of recent plain USDC transfers (single-log, sent directly to the token
contract) pulled from live Base receipts:

- gasUsed: **45,047–70,392, avg 60,240**
- exec price paid: typically **0.005–0.006 gwei** (base ≈ 0.005, tip ≈ 0.001)
- L1 data fee: ~2.7–3.0e9 wei per tx (**~0.3% of cost** today — blob fees are at
  floor levels)
- → **~$0.0009–0.0013/transfer → ~$36–52/day → ~$1,100–1,560/month**

Sensitivity: cost scales ~linearly with the L2 base fee. Observed intraday
base-fee range during measurement: 0.005–0.05 gwei (10x); a 0.19 gwei
outlier sender paid **38x the median** for the same transaction shape.

## 1. Batch transfers — ~60% of total spend (≈$680–770/mo)

Every standalone transaction pays 21,000 gas of intrinsic cost plus its own
signature/envelope; a relayer doing 40k tx/day pays that 40k times. A batching
contract amortizes it: measured on a Base mainnet **fork against real USDC**
(`forge test`, `test/BatchTokenTransfer.t.sol`):

| batch size | gas per payment (incl. amortized intrinsic) | saved vs one-tx-per-payment |
|-----------:|-------------------------------:|----------------------------:|
| 1 | 69,260 | −18% (batching loses below ~2) |
| 5 | 41,046 | **40%** |
| 10 | 29,087 | **58%** |
| **20** | **24,818** | **64%** |
| 50 | 25,336 | 63% (memory expansion erodes gains) |

Optimum is ≈20 payments/tx → 2,000 txs/day instead of 40,000. At 40k payments
/day, one batch every ~43s keeps up — same effective confirmation latency as
today's serial sends (Base blocks are 2s).

Deployed cost: contract deploy + one `approve` per token (~$0.01 total).
Reentrancy/atomicity: a failing recipient (e.g. USDC-blacklisted address) is
skipped per-payment via try/catch and emitted in `Failed` (covered by
`testSkipsBadRecipients`), so one bad payment can't revert the batch — we log
and flag rather than silently drop.

## 2. Fee policy — hard caps on what we will ever pay (~$60–300/mo avoided)

Live sampling showed a sender paying **0.1927 gwei** where the median tip was
**0.001 gwei** — a 45x overpay on the same transfer. Relayers typically leak
money via: `eth_gasPrice` with padded buffers, hardcoded tips from 2024-era
defaults, or unlimited `maxFeePerGas`. `src/fees.ts`:

- `maxPriorityFeePerGas` = p50 of the last 20 blocks' tips, clamped into
  [0.0005, 0.02] gwei
- `maxFeePerGas` = 2× base + tip, **hard-capped at 0.5 gwei** (configurable)
- live check right now: base 0.005, tip 0.001, maxFee 0.011 gwei

If the current relayer uses RPC defaults, this alone is the single biggest
line item; the plan ranks it #2 only because current spend already shows
near-median pricing.

## 3. Spike backoff — queue non-urgent payments (insurance)

Base's L2 base fee spikes 10x+ intraday (measured range above); L1 blob fees
have historically spiked 100–1000x for hours. `flush()` defers any batch with
no urgent payment while base fee > threshold (default 0.02 gwei,
configurable). Payments marked `urgent` go anyway. Expected value: prevents
spending the entire daily budget in a bad 30-minute window.

## 4. L1 data amortization (~$10/mo at today's prices; the point is spike safety)

Each standalone transfer carries ~110 bytes of tx envelope into the L1 blob
fee; batching also packs recipients/amounts more tightly. At current blob
prices the L1 component is ~0.3% of spend; the savings are the amortization of
that envelope and become material whenever L1 blob fees spike (seen repeatedly
through 2024–2025 blob waves). No extra work: falls out of #1.

## 5. Actual-spend ledger (answer finance's question continuously)

Estimates drift; receipts don't. The sender writes one CSV row per confirmed
tx (`gas_used`, `exec_price_wei`, Base's explicit `l1Fee`, USD at send time).
`node scripts/gas-report.ts` aggregates to totals and per-day. Turn it on at
deploy; history before that is estimate-only (~$1,200/mo at current volume).

## What shipped in this repo

- `contracts/BatchTokenTransfer.sol` — batching contract (per-payment try/catch,
  `Failed` event, length-mismatch guard)
- `test/BatchTokenTransfer.t.sol` — fork benchmark (table above) + bad-recipient
  and mismatch tests; all passing (`forge test`)
- `src/fees.ts` — EIP-1559 fee policy + spike detection (verified live)
- `src/sender.ts` — queue, token grouping, batch/direct fallback, spike deferral,
  `Failed` detection, nonce-safe serial flush
- `src/ledger.ts`, `scripts/gas-report.ts` — spend ledger + finance report
  (verified end-to-end)
- `npx tsc` builds clean.

## Rollout & risks

1. Deploy `BatchTokenTransfer.sol` (<$0.01), approve it once per token.
2. Point the sender at it; run one day side-by-side, compare ledger rows.
3. Cut over; keep the legacy direct path (auto-fallback when queue < batch
   target) as the escape hatch.

Risks: batching delays the tail of a batch by up to one flush interval
(configurable; mitigated by `urgent` flag); approvals to the batch contract
follow the same trust model as any disperse-style contract (minimal logic,
no admin, no value holding — it only pulls per explicit call).
