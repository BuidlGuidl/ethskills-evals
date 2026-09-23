# Relayer gas plan — 40k ERC-20 payouts/day on Base

All Base numbers below were measured live on 2026-09-23 (RPC + on-chain sampling + forge gas tests; raw data in the appendix). Re-run anything with `npm run model:live`.

## TL;DR

| # | Lever | Saving @ today's gas (0.006 gwei) | Saving @ 0.25 gwei stress | Certainty | Status |
|---|---|---|---|---|---|
| 1 | **Fee-policy check/fix** (effective gas price you actually pay) | **$0 … $1.2M/yr** | scales linearly | Conditional — measure first | Measurement commands below; policy module shipped |
| 2 | **On-chain batching** (one tx per ~200 payouts) | **$8.4k/yr (−55%)** | **$340k/yr** | Certain | Contracts + encoder + queue shipped, tested |
| 3 | **Net duplicate recipients** (product call) | $0 … $9k/yr (0–60%) | up to $370k/yr | Conditional on repeat ratio | Shipped in queue lib, flag off by default |
| 4 | **EIP-7702 executor** instead of funded contract | small gas + zero custody/allowance | same % | Certain, small | Contract shipped, tested; optional migration |
| 5 | Per-token gas audit | varies (tokens differ 45k–62k+) | scales | Informational | One-liner below |

Baseline (what we spend now): **~$15.1k/yr** at today's gas, **~$124k/yr** at 0.05 gwei, **~$618k/yr** at 0.25 gwei. End state with levers 2+3 (repeat ratio 1.6): **~$4.2k/yr** today, **~$174k/yr** at stress (−72%).

The absolute numbers are small *right now* because Base gas is at a floor (0.005–0.006 gwei). The levers are worth 55–72% forever, and their dollar value scales linearly with gas prices — the same fix that saves $8.4k this year saves ~$340k in a stressed quarter. Fee-policy misconfiguration (lever 1) is the only way this bill can be catastrophically wrong today; check it first.

## 1. What one payout costs today (measured)

Anatomy of a standalone payout tx (relayer EOA → `token.transfer(user, amt)`):

| Component | Measured value | Source |
|---|---|---|
| Gas used, full tx, USDC-like token | **62,147** | on-chain sampling (see appendix) |
| Effective gas price | **0.006 gwei** (base 0.005 pinned + ~0–0.001 tip) | `eth_gasPrice`, `eth_feeHistory` |
| L2 execution fee | 62,147 × 0.006 gwei = **$0.00101** | computed |
| L1 data fee (Fjord-compressed serialized tx) | **$0.0000154** | `GasPriceOracle.getL1Fee` on real tx bytes |
| **Total per payout** | **~$0.00103** | |

ETH spot $2,724.55 (2026-09-23). The L1 data fee is currently ~1.5% of the cost because the blob base fee is at its floor (1 wei); it has historically been 10–1000× higher, so it's worth optimizing structurally even though it's negligible today.

### Baseline spend

| Scenario | Per payout | Per day (40k) | Per year |
|---|---|---|---|
| Today (0.006 gwei) | $0.00103 | $41.25 | **$15,058** |
| Moderate stress (0.05 gwei) | $0.0085 | $339 | **$123,830** |
| High stress (0.25 gwei) | $0.0423 | $1,694 | **$618,252** |

**First action for Finance:** replace these modeled numbers with the wallet's actuals. Two ways:

1. Sample our own payouts: `cast receipt <hash> --rpc-url $BASE_RPC --json | jq .effectiveGasPrice` over ~20 recent transfers, take the median, then:
   `npm run model -- --their-effective-gwei <median>`
2. Dune (90 days, all fees incl. L1 data):

```sql
SELECT date_trunc('day', block_time) AS day, count(*) AS txs,
       sum(gas_used * effective_gas_price / 1e18) AS eth_l2,
       avg(effective_gas_price / 1e9) AS avg_gwei
FROM base.transactions
WHERE "from" = 0x<relayer> AND block_time > now() - interval '90 days'
GROUP BY 1 ORDER BY 1;
-- add sum(l1_fee)/1e18 AS eth_l1 if your Dune schema exposes base.transactions.l1_fee
```

## 2. Levers, ranked

### Lever 1 — Fee policy: measure, then fix (potentially the whole bill)

EIP-1559 means overpaying via `maxFeePerGas` is refunded, **but** two misconfigurations do burn money: a fixed high **priority fee**, and **legacy type-0 txs** (they pay `gasPrice` exactly). Relayer defaults ported from L1 habits (1–2 gwei tips) are common.

Measured context: 50th-percentile priority fee on Base right now is **~0.00075 gwei**, p90 is 0.005 gwei — i.e. **50 wei** is enough at the 10th percentile.

| Your effective gas price | Annual spend (40k/day) | Fixing to 0.006 saves |
|---|---|---|
| 0.006 gwei (healthy) | $15,058 | — |
| 0.05 gwei | $123,830 | ~$109k/yr |
| 0.5 gwei (common default) | $1,236,280 | **~$1.22M/yr (98.8%)** |

Shipped: `src/fee-policy.mjs` computes caps from `eth_feeHistory` (p75 priority clamped to 0.01 gwei, `maxFeePerGas` = next-base-fee estimate × 1.25 + tip, hard ceiling 0.5 gwei with an `acceptable:false` flag so the relayer can hold and retry instead of overpaying). Tests included.

### Lever 2 — On-chain batching: one tx per ~200 payouts (certain, ~55%)

Instead of 40,000 individual `transfer()` txs, push payouts into a queue and flush batches to a tiny immutable contract that loops `transfer()` over a packed payload.

Why it saves (forge-measured, cold-state):

| | Standalone tx | In-batch per payment |
|---|---|---|
| 21k intrinsic + ~0.7k calldata per tx | paid per payout | amortized to ~105 |
| Sender balance slot (relayer/settler) | cold every tx (~5k) | warm after first (~3k) |
| Token account access | cold (~2.6k) | warm (~0.1k) |
| Per-tx dispatch/ABI setup | per payout | ~1k fixed per batch |
| Recipient slot | 22.1k | 22.1k (unavoidable) |

Measured on the mock token (forge, exact): standalone tx-equivalent **73,839 gas** → batched **24,279 gas/payment** (−67%); marginal cost per additional payment **23,940**. For the USDC-like token measured on-chain (62,147 standalone, adds blacklist storage reads), derived batched cost is **~28,000/payment (range 24k–32k)** → **−55% L2 execution gas**.

L1 data: 40,000 serialized tx envelopes (~180–300B each, sig included) collapse into 200 batch txs; Fjord compression makes the packed 28B/payment payload nearly free on the data side: **$0.0000154 → $0.00000007 per payout (−99.6%)**. Also: 200 txs/day instead of 40,000 (nonce management, inclusion monitoring, RPC load all simplify).

At 200 payments/batch: batch tx ≈ 5.66M gas vs Base block limit 400M (measured) — 1.4% of a block. Defaults are conservative (200); up to ~1000 is safe if you accept the revert blast radius.

Dollar effect (40k/day): **$15,058 → $6,684/yr at today's gas (−55.6%); $618k → $278k at 0.25 gwei (−55%)**. Batching is also tail insurance: if blob/data fees spike 100×, standalone L1 cost becomes ~$1.5/day while batched stays ~$0.014/day — the ratio holds under any fee regime.

### Lever 3 — Net duplicate recipients (product call, potentially bigger than batching)

If any recipients receive multiple payouts per day (typical for payments apps: exchange withdrawals, merchant settlements), merge them into one net transfer per flush window. The queue already does this (`src/batcher.mjs`), default **off**; enable per token after product sign-off.

Math: repeat ratio R (payouts : unique recipients) cuts transfer count by `1 − 1/R`: R=1.6 → −37.5%, R=2.5 → −60%. Compounds with batching. Caveat: netting changes when a recipient sees value intraday (one cumulative credit instead of several) and increases value-at-risk per transfer — that's why it's a product decision, not an engineering one.

### Lever 4 — EIP-7702 delegated executor (small gas, big ops win)

Two shipping options for the batching contract:

- **`BatchSettler`** (deployed contract, pre-funded): relayer tops it up like a hot wallet; only the relayer can distribute or `sweep`. Payouts originate from the settler's address.
- **`BatchExecutor`** via EIP-7702 delegation (Base supports it since the Isthmus hardfork): the relayer EOA delegates its code to the executor, keeps its address, keeps custody — payouts still "come from" the relayer, **no funding tx, no allowance, no contract custody at all**. The executor is gated so only the EOA's own transactions can trigger it (`msg.sender == address(this)`), and `receive()` accepts plain ETH.

Gas: 7702 path measured 24,341/payment vs 24,124 for the settled path (+217/payment ≈ +0.9%) — effectively identical. The real arguments are operational (no custody to monitor, no top-up job) and the caveat set (below, risks).

### Lever 5 — Per-token gas audit (informational)

Measured transfer costs vary by token implementation (45k–62k+ on today's samples; hook-carrying or non-standard-storage tokens cost more). If we pay in several tokens, measure each before choosing payout inventory:

`cast estimate <whale-with-token> --rpc-url $BASE_RPC --value 0 <TOKEN> "transfer(address,uint256)" <dst> 1`

## 3. What's implemented in this repo

```
contracts/
  src/BatchSettler.sol      fund-and-distribute batcher (immutable relayer gate, packed + arrays paths, sweep)
  src/BatchExecutor.sol     EIP-7702 delegated equivalent (self-gated, receive())
  test/Batch.t.sol          22 tests incl. 7702 delegation via etched designator + gas measurements
  foundry.toml              solc 0.8.28, optimizer on
src/
  encode-batch.mjs          28-byte packed entries (20B address + 8B uint64 amount), full tx calldata encoders
  batcher.mjs               payout queue: netting (opt-in), flush on {count, age}, top-up planning
  fee-policy.mjs            feeHistory -> priority/base fee caps + hard ceiling policy
scripts/
  gas-model.mjs             the cost model behind this plan (--live recalibrates every input)
test/*.test.mjs             20 node tests (encoder, queue, fee policy)
```

Packed format: each entry is `20B address || 8B big-endian uint64 amount`, concatenated. uint64 caps a single payout at 18.4e12 base units (e.g. ~$18B in 6-decimal USDC terms); 18-decimal tokens or bigger single payouts use the arrays path `distribute(address,address[],uint256[])`.

### Integration (relayer loop)

```js
import { createBatcher } from "./src/batcher.mjs";
import { encodePackedBatch } from "./src/encode-batch.mjs";

const queue = createBatcher({ policy: { maxItems: 200, maxAgeMs: 5 * 60_000 } }); // netting off by default
queue.add({ token: USDC, recipient, amount });          // per payout request
if (queue.shouldFlush()) {
  const items = queue.drain();                           // netted (token, recipient) -> amount
  const { blob, total } = encodePackedBatch(items);
  // tx: to=BatchSettler, data=distributePacked(USDC, blob), gasLimit ~= 60000 + 29000 * items.length,
  //     fees from computeFeePolicy(); all-or-nothing: on revert, bisect the batch and quarantine the failing half
}
```

Keep BatchSettler's float capped: top up to ~2× pending volume (`planTopUps()`), monitor balance low-water alerts.

### Deploy

```bash
cd contracts && forge create src/BatchSettler.sol:BatchSettler \
  --rpc-url $BASE_RPC --from $RELAYER --broadcast   # deployer == immutable relayer gate
# 7702 route: deploy BatchExecutor, then sign/send one type-4 delegation tx from the relayer EOA
```

## 4. Rollout

1. **Week 1 — measure:** run the Dune query + `npm run model:live -- --their-effective-gwei <median>`. If lever-1 savings > 0, ship the fee-policy module immediately (config change, no new contract).
2. **Canary:** batch 1% of payouts (batches of 20–50) for 2–3 days. Reconcile from the token's own `Transfer` events (every payout is individually visible on-chain; `BatchSettled(token, count, total)` summary event per batch for fast accounting).
3. **Ramp:** to 100% at batch=200 (5-min flush window ⇒ max payout latency +5 min; make that SLA explicit). Compare measured batch tx gas vs the 28k/payment estimate and feed the real number back into the model.
4. **Optional:** 7702 migration to drop the funded-contract custody; then netting per token if product approves.

## 5. Risks

- **All-or-nothing batches:** one reverting recipient (e.g. a blacklisted USDC address) reverts the whole batch. Mitigation: bisect on failure + quarantine; alerting on batch revert. A partial-success mode was deliberately not built (silent drops are worse in payments).
- **Settler custody:** funds at rest in a hot immutable contract. Only the relayer can move them (`onlyRelayer`, no owner key exists); float capped by top-up sizing; `sweep` for recovery. The 7702 route eliminates custody entirely.
- **7702 caveats:** the relayer address gains code — integrations that require `code == 0` or `tx.origin == msg.sender` will treat it as a contract. Check our own flows (and any exchange allowlisting the payout source address) before migrating. Delegation is per-chain and reversible.
- **Payout source address changes** (BatchSettler route): recipients see transfers from the settler, not the relayer. Rarely matters for ERC-20s, but verify exchange deposit allowlists if any exist.
- **uint64 packed amounts:** overflow is rejected client-side and impossible on-chain (amounts are typed), but the arrays fallback must be used for high-decimal tokens.
- **Model assumptions:** the 28k/payment batched figure is derived (24k–32k range) — verify post-deploy and update the model. Everything else in this plan is measured.

## 6. Re-measuring

```bash
npm run model:live                                  # recalibrate: gas price, ETH spot
npm run model -- --their-effective-gwei 0.5        # fee-policy what-if
npm run model -- --repeat-ratio 1.6 --batch-size 500
npm test && npm run test:contracts                 # full suite
npm run gas-report                                  # per-function contract gas
```

## Appendix — raw measurements (2026-09-23)

- `eth_gasPrice`: 5,998,080 wei (0.006 gwei); `baseFeePerGas` 5,000,000 wei (0.005) flat across blocks; feeHistory rewards p10/p50/p90 = 50 wei / 0.00075 / 0.005 gwei; block gasLimit 400,000,000; blobBaseFee 1 wei; ETH spot $2,724.55.
- ERC-20 transfer txs (on-chain, 12 samples): avg 52,044 gas; USDC-like token cold-recipient samples 62,147 / 62,159; effective prices paid 0.005–0.008 gwei.
- L1 data fees via `GasPriceOracle.getL1Fee` on real serialized txs (5 samples, ~299B): avg 5.652 gwei wei ($0.0000154); synthetic 200-entry batch tx (5.7kB): 5.095 gwei wei → $0.000000069/payment.
- Forge (mock OZ-style token, cold state, per-test isolation): standalone `transfer` exec 52,109 (tx-equivalent ~73,839); `distributePacked` totals n=1: 62,640 / n=10: 278,033 / n=100: 2,431,769 / n=200: 4,824,830 → marginal 23,940/payment; `distribute` arrays n=200: 4,940,933 (24,705/payment); 7702-delegated n=200: 4,868,164 (24,341/payment); decode-only loop 311/entry; noop-token loop 1,257/entry.
- Derivation of 28,000/payment for the USDC-like token: its standalone exec (≈41k) minus warm-able sender/account accesses (≈7k) plus its extra per-recipient blacklist storage reads (≈4–6k, cold per recipient) plus loop overhead (≈1k). Mock-measured range supports 24k–32k.
