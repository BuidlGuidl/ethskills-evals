# Base Payout Gas Plan

**Scope:** ~40,000 ERC-20 transfers/day, all sent from our relayer wallet on Base.

All numbers below were **measured live on 2026-09-23 (12:16–12:32 UTC)** against
Base mainnet (`https://mainnet.base.org`) and Coinbase spot ETH/USD. Nothing is
from memory. Re-run `node scripts/quote.mjs --token usdc` any time to regenerate
the finance table at current prices.

---

## 0. What we spend today (baseline)

Per USDC transfer sent as its own tx (from real Base receipts, block ~51,688,240):

| Component | Measured | USD (ETH $2,722) |
|---|---|---|
| L2 execution, first-time recipient | 62,171 gas × 0.006 gwei | $0.001015 |
| L2 execution, repeat recipient | 45,047 gas × 0.006 gwei | $0.000736 |
| L1 data fee (`l1Fee` on receipt) | 3.23 gwei-wei = 3.23e-9 ETH | $0.0000088 |
| **Total per transfer** | | **$0.00103 (cold) / $0.00075 (repeat)** |

Market readings at measurement time: gas price 0.006 gwei (base fee 0.005 + tip 0.001),
blob base fee 0.0167–0.0196 gwei, ETH $2,718–2,726.

| Scale | Cold recipients | Repeat recipients |
|---|---|---|
| Per day (40k transfers) | **$41.20** | **$29.90** |
| Per 30 days | $1,236 | $897 |
| Annualized | ~$15k | ~$11k |

Notes:
- Today's split is ~99% L2 execution / ~1% L1 data fee, because blob fees are in
  a cheap regime and Base gas is 0.006 gwei. This flips in expensive regimes:
  at 10× blob fee the L1 fee is ~10% of cost; at 0.5 gwei gas (Base demand
  spikes run 10–100× the floor), execution cost is ~83× today's. The plan below
  cuts **both** components and is regime-proof.
- **First step for finance: run `node scripts/audit.mjs --address 0x<relayer>`.**
  It pulls our actual txs, breaks down execution vs L1 data spend, and compares
  against what the same txs would have cost with minimum-tip EIP-1559 fields in
  the same blocks. Any priority-fee overpayment shows up there.

---

## 1. Batch payouts through `BatchRelayer` — **shipped**, saves ~51–63% now, more in expensive regimes

One tx per batch instead of one tx per transfer. Saves the 21,000-gas intrinsic
cost per transfer, the per-tx call/dispatch overhead, and ~84% of the L1 data
fee (the envelope — signature, nonce, RLP — is paid once per batch, and packed
calldata items are zero-byte-heavy, which the L1 pricer discounts 4×).

Measured on a live Base fork against real USDC (`test/BatchRelayer.base.fork.t.sol`),
with L1 fees priced by the `GasPriceOracle` predeploy on byte-identical tx shapes
(validated within 4% of a real raw transfer tx):

| | Standalone | In batch (N=300) | Saving |
|---|---|---|---|
| L2 gas per transfer (cold) | 62,171 | 30,650 (amortized) | 51% |
| L2 gas per transfer (repeat) | 45,047 | ~9,250 (amortized) | 79% |
| L1 data fee per transfer | 4.02 gwei-wei | 0.63 gwei-wei | 84% |
| **Cost per transfer** | **$0.00103** | **$0.00050** | **51%** |
| Blended 50/50 cold/repeat | $0.00089 | $0.00033 | 63% |

**Daily impact at 40k transfers/day (today's prices): $41.20 → $20.10 (cold) —
save ~$630/30d. Blended 50/50 cold/repeat: ~$35.60 → ~$13.10 — save ~$675/30d
(63%). All-repeat recipients: $29.90 → $6.00 — save 80%.**

Sensitivity — savings scale linearly with gas price (structure of the saving is fixed):

| Base gas price | Standalone/day | Batched/day | Saving/day |
|---|---|---|---|
| 0.006 gwei (today) | $41 | $20 | $21 |
| 0.05 gwei (typical busy day) | $346 | $170 | $176 |
| 0.5 gwei (demand spike / FLO-style campaigns) | $3,390 | $1,670 | $1,720 |

Shipped code:
- `src/BatchRelayer.sol` — auditable-surface contract: `batchTransferFrom`
  (pull model: relayer approves once, funds never sit in the contract),
  `batchTransfer` (float model, ~3k gas/item cheaper, holds a float),
  `rescue()` for stray tokens, `onlyOwner`, fail-closed (any rejected transfer
  reverts the whole batch, including non-bool-returning USDT-style tokens which
  are treated as success on empty return, `false` return or revert = fail).
- `test/BatchRelayer.t.sol` — 10 unit tests including fail-closed paths.
- `test/BatchRelayer.base.fork.t.sol` — live-Base-fork gas measurements (the
  numbers above).
- `scripts/send-batch.mjs` — builds the batch from a payouts JSON, estimates
  gas, derives fee fields live, prints or sends via `cast`. Verified end-to-end
  on a Base fork: 3-payout batch consumed 121,465 gas (~40.5k/payout all-in) and
  funded all recipients.

Rollout (config, not code):
1. `forge create src/BatchRelayer.sol:BatchRelayer --rpc-url $BASE_RPC_URL --private-key $RELAYER_KEY` (deployer = relayer EOA → owner).
2. Relayer EOA approves the contract once per token:
   `cast send $TOKEN "approve(address,uint256)" $RELAYER $(cast max-int) ...`
3. Point the payout queue at `send-batch.mjs` in chunks of ~100–300
   (40,000/300 ≈ 134 batches/day ≈ one every ~11 min; batch = latency policy).

Ops notes:
- **USDC erodes even "unlimited" allowances** (measured: Circle decrements
  `type(uint256).max` by the batch total). Alert when
  `allowance(relayer, BatchRelayer) < 2× daily volume` and re-approve; the
  re-approve tx costs ~$0.0007 at today's prices.
- Fail-closed means one bad recipient reverts the batch: dedupe/validate
  addresses upstream and keep batches chunked to bound retry cost.
- Fee-on-transfer/rebasing tokens are NOT supported (they fail closed). USDC,
  USDT-style, and standard ERC-20s are.
- Consider a second relayer-specific key: the contract is onlyOwner on the
  payout path; a dedicated ops key avoids touching the treasury signer.

## 2. Right-size EIP-1559 fee fields — **shipped** (fee-fields.mjs + audit.mjs); saving = whatever we currently overpay, potentially the largest line item

Measured right now on Base: suggested tip is **0.001 gwei** (0.006 gwei
`gas-price` − 0.005 gwei base fee). Actual prices paid by others in receipts
sampled today: 0.006 gwei, 0.010, 0.0172, and up to **4.74 gwei** — overpaying
the tip is common when relayer configs port mainnet-style constants.

What each stale default costs at 40k transfers/day (per-transfer gas 62,171, ETH $2,722):

| Effective tip paid | Excess cost per transfer | Excess cost per day |
|---|---|---|
| 0.001 gwei (correct) | $0 | $0 |
| 0.05 gwei | $0.0085 | $338 |
| 0.1 gwei | $0.0169 | $677 |
| 1 gwei | $0.169 | $6,768 |
| 2 gwei (mainnet-style default) | $0.338 | $13,536 |

This stays material after batching (134 batches/day × ~9.1M gas): a 2 gwei tip
is still ~$6,640/day of excess.

Shipped code:
- `scripts/fee-fields.mjs` — derives `maxFeePerGas` (base fee × 1.15 + tip) and
  `maxPriorityFeePerGas` (measured suggested tip, clamped 0.001–0.05 gwei) live,
  immediately before submission. `--wait-below-gwei` gates on base fee (item 3).
  Integrate the JSON output into the relayer's tx construction; never hardcode.
- `scripts/audit.mjs` — quantifies today's overpayment on our actual wallet
  (see §0). Run this before assuming savings; if we already pay minimum tip this
  item saves $0 and that's the answer.

## 3. Gate sending on base fee (off-peak scheduling) — **shipped as a flag**; regime-dependent saving

Base base fee is 0.005 gwei right now but demand spikes push it 10–100× for
hours at a time. For payouts with latency tolerance, hold the queue when the
base fee is above a threshold and drain when it drops:

`node scripts/fee-fields.mjs --wait-below-gwei 0.05 --poll-seconds 30`

Expected value: eliminates the execution-fee premium during spikes (the
majority of spend on peak days); zero effect in the current cheap regime. Not
ranked above items 1–2 because the saving is timing-dependent, not structural.
Combined with batching this is nearly free to implement — it's the same script
call with one flag.

## 4. Considered and rejected

- **ERC-4337 / paymaster bundling** — adds ~45k+ gas of overhead per op; our
  controlled relayer already batches better.
- **Tighter calldata packing in the batch** (offsets as packed bytes) —
  L1 data fee is ~1–4% of total; projected saving <0.1% of spend. Not worth
  the audit surface.
- **Non-OP-stack L2s / other chains** — out of scope for this question; the
  fee model would need independent measurement anyway.
- **Priority fees above minimum as policy** — only worth it during congestion
  if latency is contractual; the sequencer otherwise includes cheap txs fine.
  Cap is in the fee-fields config (`--max-tip-gwei`).

---

## Reproducing the numbers

```bash
# finance-facing live quote (per-transfer, daily, 30-day, standalone vs batched)
node scripts/quote.mjs --token usdc                 # 40k/day default
node scripts/quote.mjs --token usdc --batch-size 300

# what our relayer actually spent vs minimum counterfactual
node scripts/audit.mjs --address 0x<relayer>

# EIP-1559 fields before each batch send (relayer integration)
node scripts/fee-fields.mjs

# send a batch (dry-run by default)
node scripts/send-batch.mjs --relayer 0x.. --token usdc \
  --from 0x<relayer EOA> --payouts payouts.json [--send]
```

RPC: `BASE_RPC_URL` (defaults to the public `https://mainnet.base.org`; point
it at a paid endpoint for production use). Tests: `forge test` (unit),
`forge test --match-contract BatchRelayerBaseForkTest -vv` (live-fork
measurements).

## Methodology and caveats

- Gas units measured from real receipts and a live-Base-fork simulation with
  real USDC storage; validated three ways: receipt `gasUsed` (62,171 cold /
  45,047 repeat), `eth_estimateGas` (62,964/45,199 — within 1.3%), and the
  fork run (66,598 exec-only, i.e. receipt minus 21k intrinsic, within 7%).
- L1 data fees measured, not estimated: `l1Fee` read off live receipts
  (3.23 gwei-wei at inclusion), and batched L1 priced via
  `GasPriceOracle.getL1Fee()` at `0x4200…000F` on synthetic type-2 txs with
  byte shapes identical to real ones (synthetic pricing validated against a
  real raw tx: 4.13 vs 3.98–4.31 gwei-wei across blob-fee drift, ±4%).
- USD conversion: Coinbase spot ETH-USD at each run; costs scale linearly with
  ETH price, gas price, and blob base fee. Today's readings are a cheap regime;
  the sensitivity tables show the other regimes.
- Circle-USDC-specific behavior (allowance erosion under "unlimited" approval)
  is measured on the fork, not assumed from OZ conventions.
