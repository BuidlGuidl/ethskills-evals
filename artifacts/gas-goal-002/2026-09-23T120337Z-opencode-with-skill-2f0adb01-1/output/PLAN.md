# Gas spend plan — 40k ERC-20 payouts/day on Base

Finance asked: what do we spend on gas, and what can we do about it?

**Short answer:** at today's prices a well-tuned relayer spends **~$35/day (~$1,060/month)** for
40,000 transfers. If our relayer uses mainnet-style fee settings (a 0.05 gwei priority fee is a
common copy-paste default), we are burning **~$320/day (~$9,600/month)** — 9x more than necessary.
The two changes below (fix fees if needed, batch payouts on-chain) get us to **~$500/month**, and
they halve our exposure during fee spikes. Everything code-side is implemented and tested in this
repo.

All numbers below were measured live on Base on 2026-09-23 (methodology at the bottom).

---

## What we actually spend today

A single ERC-20 transfer tx from our relayer costs two things:

| component | measured value | cost per transfer |
|---|---|---|
| L2 execution gas | 62,147 gas (cold recipient) / 40,271 (warm), paid at ~0.006 gwei effective | $0.00102 / $0.00066 |
| L1 data fee (blob) | 1,600 compressed units × blob base fee 0.018 gwei | $0.0000081 |

- Blended (assume 60% of payouts go to never-before-paid addresses): **~$0.00088 per transfer**
- At 40,000/day: **$34.91/day → ~$1,047/month → ~$12,600/year** (ETH at $2,726)
- L2 execution dominates at ~99% of cost. The L1 data fee is currently negligible — but it is the
  part that explodes during blob-fee spikes, so it matters for tail-risk.

**Caveat:** this is the *floor* for a correctly-configured relayer. What we *actually* pay is
whatever `maxFeePerGas`/priority our relayer sends. Live Base receipts show some wallets paying
**0.015 gwei effective when 0.006 suffices (2.5x)**. If we inherited a 0.05 gwei tip from a
mainnet config, the same volume costs **~$9,600/month**; at 0.1 gwei, **~$18,300/month**.

→ Run the shipped report first (1 command, below). It tells you which regime we're in.

```bash
ADDRESS=<relayer wallet> HOURS=24 npm run finance-report
```

---

## The plan, ranked by what each change saves

| # | change | saves (at current prices) | saves (fee spike) | status |
|---|---|---|---|---|
| 1 | Measure actual spend (per relayer tx) | up to $8,500/mo if tips are overpaid | — | **shipped** (`src/finance-report.ts`) |
| 2 | Right-size fees + defer on spikes | up to ~$8,500/mo (regime-dependent, see report) | more | **shipped** (`src/fees.ts`, wired into batcher) |
| 3 | Batch payouts via `MultiSender` contract | **$560/mo** (53% of L2 gas: 62,147→32,017 gas/transfer cold, 40,271→14,883 warm) | **$2,780–7,270/mo** | **shipped** (contract + tests + relayer integration) |
| 4 | Net same-recipient payouts in the queue | $0–250/mo more, scales with repeat rate (2 payouts/recipient/day ⇒ 50% fewer transfers) | doubles in spikes | **shipped** (opt-in in `src/payout-batcher.ts`); needs a policy decision |
| 5 | Pull-based settlement (users withdraw on demand) | up to 90% of everything | same | product decision, not implemented |
| 6 | Leave Base / move chains / custom token | negative | — | rejected, see below |

Combined realistic end-state: **#2+#3 → ~$500/month; adding #4 (2 payouts/recipient) → ~$260/month**
— a 53–76% cut from the tuned floor, more from the overpaid regime.

---

## 1. Measure what we actually spend (day 0, zero risk)

`src/finance-report.ts` pulls our relayer's transactions from the last N hours, splits each tx's
fee into L2 execution vs L1 data (OP-Stack receipts expose `l1Fee`), and prints per-tx cost, the
observed run-rate, and — most importantly — **how much we overpay vs the current fee floor**.

```bash
ADDRESS=0x<relayer> HOURS=24 npm run finance-report     # daily
ADDRESS=0x<relayer> HOURS=168 npm run finance-report    # weekly for finance
```

Sample output from a real address measured today (per-tx figures only — this wallet isn't ours):

```
| median effective gas price | 0.0066 gwei |
| current Base base fee       | 0.0050 gwei |
| median overpayment vs floor | 1.1x        |
```

If the report shows a median effective price ≥ 0.02 gwei, item #2 alone is worth five figures a
year. Point Finance at this command; it needs no indexer.

## 2. Right-size the relayer's fee policy (days, ~$0 to ship)

Current conditions on Base: base fee ~0.005 gwei, priority fees of 0.001 gwei get you included in
the next block. The floor per transfer is ~$0.001; a 0.05 gwei mainnet-style tip turns the same
transfer into $0.0080 — and 40,000 of them into **$9,600/month**.

Shipped in `src/fees.ts`:

- `recommendFees(baseFee)` → `maxFeePerGas = baseFee × 1.25 + 0.001 gwei`, capped at 0.05 gwei
- `isSpike(baseFee)` → batcher defers non-urgent flushes above 0.05 gwei instead of paying the spike
- Wire into the existing relayer: replace hard-coded gas price with these two calls (both pure,
  tested in `src/fees.test.ts`)

Worst case (0.05 gwei tip regime): saves **~$8,500/month**. Best case (already tight): ~nothing,
and you know it from the report.

## 3. Batch payouts — `MultiSender` (ship now)

Today every payout is its own tx, so we pay 21,000 intrinsic gas + calldata + a fresh
access-list per transfer. Batching N payouts behind one tx removes that overhead per transfer:

| | per-transfer L2 gas | 40k/day at 0.006 gwei | monthly |
|---|---|---|---|
| standalone (live receipts) | 53,397 blended | $34.91 | $1,047 |
| via `MultiSender` (measured) | **25,163 blended** | $16.44 | $494 |

- Cold recipient: 62,147 → 32,017 gas (**−49%**); warm: 40,271 → 14,883 (**−63%**).
  Measured in `test/MultiSender.t.sol` against a mock calibrated to live USDC receipts.
- L1 data per transfer also drops ~63% (64 bytes of calldata vs ~110-byte standalone tx) —
  $0.000005/tx today, but it's what saves us if blob prices spike: at blob 5 gwei that's
  $0.0014/tx avoided, **~$1,700/month** of tail-risk.
- Operational bonus: 40,000 tx/day → ~160–800 tx/day (batch size 250 default, 500 hard cap),
  which collapses nonce-management and RPC-load headaches in the relayer.

Cost to ship: one deploy (~600k gas ≈ **$0.01** at current prices) + one `approve` per token
(~46k gas, one-time). The relayer keeps custody — the contract is owner-locked to the relayer
and pulls funds via `transferFrom` only when the relayer calls it.

Shipped:

- `contracts/MultiSender.sol` — `payout` (atomic: all-or-nothing), `payoutPartial` (returns a
  failure bitmap so one bad recipient doesn't hold up payroll), `payoutMixed` (multi-token).
  `onlyOwner`, `MAX_BATCH = 500`, no external deps, 0.8.28.
- `test/MultiSender.t.sol` — 12 tests incl. gas-savings assertions and failure semantics
  (revert / false-return / frozen-recipient tokens)
- `script/Deploy.s.sol` — deploy with the relayer as owner
- `src/payout-batcher.ts` — relayer-side queue: groups by token, chunks to `batchMaxItems`
  (default 250), checks/creates the token allowance, estimates gas (+20% margin), applies the fee
  policy, defers on spikes, polls receipts, reports failed ids
- `src/example.ts` — projections + a working `viem` signer wiring (`BROADCAST=1` for live)

Rollout:

1. `forge build && forge test`
2. `forge script script/Deploy.s.sol --rpc-url $BASE_RPC --broadcast` (sender = relayer EOA)
3. Relayer approves `MultiSender` for each payout token (the batcher also auto-approves)
4. Cut over a small % of payout traffic behind the batcher (`mode: "partial"` recommended
   during rollout), watch `PayoutBatched` events, ramp to 100%

## 4. Net repeat payouts in the queue (product sign-off, shipped off by default)

If Finance/Product can accept same-recipient payouts being merged (e.g. two payouts to the same
user within the 15s flush window become one transfer), the queue-side netting in `netPayouts()`
collapses them before batching. Value depends entirely on our payout mix:

| repeat payouts per recipient/day | transfers after netting | monthly cost (post-batching) |
|---|---|---|
| 1.0 (no repeats) | 40,000 | $494 |
| 1.5 | ~27,000 | $333 |
| 2.0 | 20,000 | $247 |

The correct policy (min-interval per recipient, FIFO fairness) is a business call — the
mechanism is already in the batcher.

## 5. Pull-based settlement (product decision, biggest possible lever)

Instead of pushing every payment on-chain immediately, credit balances off-chain and let users
withdraw (batched on our side, or via our own faucet-like flow). Real-world withdrawal patterns
typically compress 40,000 transfers/day to well under 10,000 effective transfers — 60–90% off
everything above. This changes product/ops (liability for pending balances, compliance view of
"unpaid" amounts) — flagged for a separate decision, not implemented.

## 6. Things we deliberately are NOT doing

- **Leaving Base.** Base is the correct venue for 40k consumer payments/day (sub-cent fees, 2s
  blocks). Mainnet is now cheap (~$0.013/transfer) but still ~13x Base; no other L2 is
  meaningfully cheaper for this workload. Migration cost alone exceeds years of savings.
- **A gas-optimized payout token.** We need USDC; a custom token saves ~10k gas/transfer but is a
  product blocker.
- **EIP-7702 (EOA delegation) instead of `MultiSender`.** Same savings without the approve/step,
  and keeps funds in the relayer EOA. Worth revisiting in a quarter once Base relayer tooling
  matures; the contract works everywhere today.
- **Timing games around blob fees.** Blob base fee is 0.018 gwei; the L1 data fee is 0.8% of
  our bill at current prices. The batcher's spike-defer covers the tail.

---

## How the numbers were measured (reproducible)

- Live receipts of real USDC (`0x833589fcd6edb6e08f4c7c32d4f71b54bda02913`) transfers on Base,
  2026-09-23: `gasUsed` 62,147 (cold recipient) / 40,271 (warm); `l1Fee` 0.000000002968 ETH;
  effective gas prices 0.0057–0.015 gwei.
- Base base fee 0.005 gwei (block 51,687,859), block gas limit 400M. Mainnet blob base fee
  0.018 gwei. ETH $2,726 (CoinGecko).
- Batched gas per transfer measured by `forge test --match-test test_GasSavings` using a mock
  calibrated to the live receipts (standalone estimate 56.5k vs live 62.1k — conservative).
- Projections: `node src/example.ts` (params: `COLD_SHARE`, `TRANSFERS_PER_DAY`, `BATCH_SIZE`).
- Actual spend: `npm run finance-report` (assumptions: 60% cold recipients; USDC gas profile —
  other tokens vary ±10%).

Sensitivity (monthly at 40k/day, blended):

| scenario | unbatched | batched | saved |
|---|---|---|---|
| now (0.006 gwei) | $1,047 | $494 | $554 |
| busy (0.03 gwei) | $5,251 | $2,474 | $2,777 |
| spike (0.06 gwei + blob 5 gwei) | $13,228 | $5,956 | $7,272 |

## Repo map

| path | what |
|---|---|
| `contracts/MultiSender.sol` | payout batcher (owner-only, transferFrom-based) |
| `test/MultiSender.t.sol` | 12 tests incl. measured gas savings vs live receipts |
| `script/Deploy.s.sol` | deploy script (owner = deploying relayer) |
| `src/rpc.ts` | zero-dep JSON-RPC client with retry/rotation |
| `src/fees.ts` | fee policy: headroom, cap, spike-defer (pure, tested) |
| `src/payout-batcher.ts` | queue: netting, grouping, allowance, gas/fee handling, receipts |
| `src/finance-report.ts` | what we actually spend, split L2/L1, overpayment check |
| `src/example.ts` | projections + working viem signer wiring |
| `src/*.test.ts` | node tests (fee math, netting, ABI encoding vs cast reference) |

```bash
npm test          # forge test + node --test
node src/example.ts
```
