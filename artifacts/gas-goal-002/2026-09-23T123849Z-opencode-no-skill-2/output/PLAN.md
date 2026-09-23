# Relayer gas plan — Base payments (≈40k ERC-20 transfers/day)

**Date:** 2026-09-23 · **Scope:** relayer wallet gas spend on Base · **Author:** eng
**Bottom line:** ~70% of our gas bill is structural overhead we can delete by batching
transfers through a small immutable contract. Everything below is measured, not guessed:
standalone costs come from on-chain receipts, batched costs from Foundry tests forked
against Base mainnet with real USDC.

---

## 1. What we spend today (measured 2026-09-23)

A live USDC transfer from a relayer-style wallet on Base right now:

| Component | Measured value | Cost (ETH @ $2,721) |
|---|---|---|
| L2 execution: 62,159 gas @ 0.006 gwei effective | 373 gwei | **$0.001016** |
| L1 data fee (blob basefee 0.019 gwei) | 3.04 gwei | $0.0000083 |
| **Total per transfer** | | **≈ $0.00102** |

- 40,000/day → **≈ $41/day**, **≈ $15k/yr** at today's (historically low) fees.
- That is the *good* regime. Base's L2 basefee has ranged from 0.005 gwei (today) to
  0.3+ gwei during demand spikes; at 0.05 gwei the same traffic costs **≈ $400/day**,
  at 0.3 gwei **≈ $2,500/day**. Our spend is fee-regime-levered; the fix below is a
  permanent ~70% cut in *any* regime.
- Per-transfer gas breakdown of a standalone transfer: 21,000 intrinsic (tx envelope)
  + ~2,600 cold token-contract access + ~5,000 relayer balance-slot writes + 20,000
  (new recipient) or 2,900 (funded recipient) recipient-slot write + ~10k USDC code.
  **Only the two balance-slot writes are unavoidable.** Everything else is per-transaction
  overhead that disappears when transfers share a transaction.

Re-run with our real receipts any time:
```
node scripts/gas-audit.mjs --relayer 0xOurRelayerAddress --blocks 300
```

## 2. Changes, ranked by what they save

### #1 — Batch transfers through the Disburser contract (~63–80%, blended ~70%) ✅ SHIPPED

One transaction sends up to 250 transfers: the relayer approves the contract once, then
sends one `disburseFrom(token, packed, strict)` call per batch. Each transfer is 32
packed bytes (20-byte address + uint96 amount) instead of its own signed transaction.

Fork-measured on real USDC (Base mainnet, block 51,689,180 — `forge test --match-path
test/DisburserFork.t.sol --fork-url https://mainnet.base.org -vv`):

| Scenario | Standalone tx | Batched (250/batch) | Cut |
|---|---|---|---|
| Warm recipient (already holds USDC) | 62,159 gas (on-chain receipt) | 12,943 gas | **79%** |
| Cold recipient (first payout) | ~80,700 gas | 29,955 gas | **63%** |
| L1 data fee per transfer | ~1,600 compressed units | ~35 units | **~98%** |

What the two sub-changes save:

- **Transaction-count amortization** (the big one): kills 21k intrinsic, 2.6k cold
  contract access, per-tx signature/nonce/RLP envelope (~135 B of L1 data per tx),
  17k gas of cold relayer-slot reads per batch instead of per transfer.
- **Packed encoding** (32 B/transfer vs ~64 B for ABI arrays + no per-tx signature):
  cuts the L1 data slice ~45× (1,600 → ~35 compressed units/transfer). Today that slice
  is 0.8% of the bill, but during blob-fee spikes it grows ~50–500× and this is what
  caps the damage.

Savings at 40k/day, 50% cold recipients (from `node scripts/cost-model.mjs`):

| Fee regime | Today | Batched | Save |
|---|---|---|---|
| Today (0.006 gwei) | $47/day | $14/day | $33/day (~$12k/yr) |
| Busy (0.05 gwei, blob 1 gwei) | $406/day | $117/day | $289/day (~$106k/yr) |
| Spike (0.3 gwei, blob 10 gwei) | $2,508/day | $704/day | $1,804/day |

Batch size vs. payout latency (today's fees; 40k/day ≈ 1 transfer every 2.2 s):

| Flush policy | Avg batch | Cost/day | Savings |
|---|---|---|---|
| every 30 s | ~14 | $18.2 | 61% |
| every 60 s | ~28 | $16.0 | 66% |
| every 5 min | ~139 | $14.2 | 70% |
| full 250 cap | ~250 | $14.0 | 70% |

**Recommendation: flush at 250 transfers or 60 s, whichever first.** Cost is nearly flat
past 60 s; payout latency isn't. Side effects: 40,000 → ~1,000–2,900 txs/day to sign,
track, and retry; nonce management and RPC bills shrink accordingly.

Code: `src/Disburser.sol` (immutable, no admin, no custody — failures are swept back to
the caller), `relayer/` (packer + queue + viem sender). Tests: 13 Solidity + 14 TS, green.

### #2 — Failure isolation: safe mode + pre-send simulation ✅ SHIPPED (protects #1)

USDC can revert individual transfers (Circle blacklist, closed recipient slot). A naive
strict batch that hits one reverts wholesale — we'd pay for the full batch gas **and**
re-send it (2× gas, plus payout delay). Mitigations, both already in the shipped code:

- `strict = false` mode: a failing transfer is skipped, the batch settles, the failure
  is emitted as `TransferFailed(index, recipient, amount)` and swept funds return; the
  relayer retries only the failures. (Strict mode exists for canary/debug runs.)
- `simulateContract` before every send (`relayer/relayer.ts`) — catches packing and
  state errors off-chain, where they're free.

Daily dollars are small at a 0.1–1% failure rate (~$1–4/day), but this is what makes
batching safe to ship. Also cuts today's retry waste: each currently-reverted
standalone tx is 100% wasted gas.

### #3 — Fee-config audit: 30 minutes, possibly the largest item of all ⚠️ CHECK FIRST

The sampled live transfer pays an effective 0.006 gwei (0.005 basefee + 0.001 tip) —
correct for Base. But relayer codebases forked from mainnet templates often send
0.1–1 gwei priority fees. **If ours does, the L2 slice costs 17–170× more than
necessary: at 1 gwei effective, 40k transfers/day ≈ $6,760/day** — an order of magnitude
bigger than everything else in this plan.

Action: read `effectiveGasPrice` from our own recent receipts
(`node scripts/gas-audit.mjs --relayer 0x...`) and cap priority fees in the sender
config (`maxEffectiveGasPriceGwei` is already a knob in `relayer/batcher.ts`,
default 0.25 gwei). Zero code risk. If the audit shows ~0.006 gwei, this costs nothing
and we move on.

### #4 — EIP-7702 delegated batching (alternative delivery of #1)

Since Base's Isthmus hardfork, the relayer EOA can delegate to the Disburser code and
call `disburseOwn(...)` directly from the same wallet — no new contract to fund, no
allowance, treasury/ops keep the address. The contract ships this path (guarded so it
only runs in delegated context, tested with a real signed authorization in
`test_EIP7702DelegatedDisburseOwn`). Same savings as #1 within rounding. Adopt when the
signer stack supports authorization lists; until then the #1 path (deploy + approve) is
already equivalent.

### #5 — Fee-timing gate (small; shipped as a knob, default off)

Only the L1 data slice responds to timing, and it is 0.8% of today's bill. The batcher
can hold a flush while gas exceeds `maxEffectiveGasPriceGwei`, which is worth ~10–30%
of the L1 slice during blob spikes. Don't delay payouts for more than a minute or two
for it.

## 3. What we are NOT doing (and why)

- **Gas tokens / refund farming** — removed from the EVM (EIP-3529), don't exist on Base.
- **Higher priority fees to "win blocks"** — Base's sequencer is FCFS, there is no
  priority auction; extra tips are pure overpayment (see #3).
- **ERC-4337 bundling** — pays ~45k+ gas per user operation for aggregation/auth we
  don't need; we are the sender, so a plain batch contract is strictly cheaper.
- **Switching tokens or L1 migration** — out of scope for a gas question.

## 4. Rollout plan

1. **Verify numbers against our wallet** — `npm run audit -- --relayer 0x...` (ground
   truth from our receipts; confirms #3 at the same time).
2. **Deploy** `Disburser` (~400k gas, ≈ $0.01 at today's fees; address is immutable,
   no admin keys to manage). One-time `approve()` from the relayer (≈ $0.001).
3. **Canary** — one 10-transfer batch, reconcile balances + `Disbursed`/`TransferFailed`
   events against the payout ledger.
4. **Ramp** — 10% of traffic day 1 → 50% day 3 → 100% within a week. Failed-transfer
   events route back to the existing retry path automatically.
5. **Monitor** — alert on `TransferFailed` rate >1% and on effective gas price paid
   >2× basefee; track $/transfer weekly with the audit script.

Risks & mitigations:
- *Packing bug misdirects a payout* — golden vectors cross-tested in both languages,
  `simulateContract` before every send, canary batch, amounts capped at uint96.
- *USDC blacklist mid-batch* — safe mode isolates to a single `TransferFailed` event.
- *Contract holds no custody* — pull-exact-total; leftovers swept in the same tx;
  permissionless but can only move the caller's own allowance'd tokens (no admin keys
  anywhere).
- *Allowance exposure* — approving the Disburser adds no new attack surface vs the
  relayer key itself (which can move funds regardless).

## 5. Repo layout / how to run

```
src/Disburser.sol          batch contract (immutable, no dependencies)
test/Disburser.t.sol       13 tests: correctness, failure isolation, 7702, gas benches
test/DisburserFork.t.sol   real-USDC measurements on a Base mainnet fork (opt-in)
relayer/packer.ts          32-byte transfer packing (golden-vector parity with Solidity)
relayer/batcher.ts         flush queue + fee gate (pure logic, unit-tested)
relayer/relayer.ts         viem wiring: simulate → send → reconcile events
scripts/gas-audit.mjs      what we actually spend, from our own receipts (zero deps)
scripts/cost-model.mjs     the numbers in this file, re-runnable with any assumptions
```

```
forge test                                   # local suite (fast)
forge test --match-path test/DisburserFork.t.sol \
  --fork-url https://mainnet.base.org -vv    # real-USDC gas measurements
npm install && npm test                       # packer/batcher tests
node scripts/cost-model.mjs --help            # model with your own fee assumptions
```
