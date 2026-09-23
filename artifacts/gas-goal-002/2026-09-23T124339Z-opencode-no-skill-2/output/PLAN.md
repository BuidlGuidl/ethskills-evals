# Gas Plan — Base ERC-20 Payout Relayer

**Scope:** ~40,000 ERC-20 transfers/day, all sent from one relayer wallet on Base.
**Goal:** know what we spend, cut it, ship the code that does it.

---

## 1. What we spend today (baseline)

Assumptions (Sept 2026, sourced — see bottom):

| Input | Value |
|---|---|
| Transfers/day | 40,000 |
| Gas per ERC-20 transfer | ~65,000 (typical Base ERC-20 transfer; 51k existing holder, ~65k+ new holder) |
| Base L2 base fee | 0.005 gwei floor, ~0.006 gwei typical incl. tip |
| ETH price | ~$2,500 |
| L1 data fee | ~$0.000003/tx today (negligible, but volatile — see §5) |

Math:

```
40,000 tx/day × 65,000 gas = 2.6B gas/day
2.6B × 0.006 gwei          = 0.0156 ETH/day ≈ $39/day
                             ≈ 5.7 ETH/year  ≈ $14,200/year
```

L1 data fees add ~$0.10/day at current blob prices — rounding error today, but it
tracks Ethereum congestion and can 10–100x during mainnet spikes.

**Baseline: ~$14k/year, dominated by L2 execution gas.**

---

## 2. Ranked changes

| # | Change | Saving | $/year (of ~$14.2k) | Status |
|---|---|---|---|---|
| 1 | Batch payments through `BatchTransfer` contract | **56–82% of L2 gas** (measured) | **~$8,000–11,500** | ✅ implemented + tested |
| 2 | Fix EIP-1559 fee params (0.001 gwei tip, capped maxFee) | 0–40% of remaining, config-dependent | up to ~$2,500 | ✅ implemented in relayer script |
| 3 | Hold non-urgent batches during L1 data-fee spikes | 0–30% of L1 component | ~$0 today; insurance against spikes | 📋 policy, not code |
| 4 | Gas-audit one day of receipts to firm up #2 | — | replaces assumptions with actuals | 📋 runbook below |

### Change 1 — Batch the transfers (the big one)

Every standalone transfer pays a fixed 21,000 gas intrinsic + ~1,100 gas calldata
overhead, and touches every storage slot cold. One batch tx pays that once.

Measured with Foundry on a 6-decimal ERC-20 (`forge test`, 50-payment batches),
and reproduced on-chain against anvil (1,382,890 gas per 50-payment batch):

| Method | Gas / 50 payments | Gas / payment | vs. status quo |
|---|---|---|---|
| 50 individual txs | 3,967,109 | 79,342 | — |
| 1 batch, first-time recipients | 1,432,095 | 28,642 | **−64%** |
| 1 batch, repeat recipients | 568,949 | 11,379 | **−86%** |

Against the more conservative 65k/transfer baseline (typical mix of new/existing
recipients), batching saves **~56% cold, ~82% on repeat recipients**. Reality is a
mix; plan on **~60%**.

```
Today:    40,000 × 65,000 gas × 0.006 gwei = 0.0156 ETH/day ≈ $39/day
Batched:  ~40% of that                     = 0.0062 ETH/day ≈ $15.6/day
Saving:   ≈ 0.0094 ETH/day ≈ $23/day ≈ $8,500/year (≈ 3.4 ETH)
```

Bonus, not in the number above: 50 payments = 1 serialized tx instead of 50, so the
L1 data fee also drops ~50x per payment. Trivial today, meaningful during L1 spikes.

Trade-offs, honestly:
- Payments settle in batches → slight added latency (bounded by batching interval).
- One bad payment reverts the whole batch → validate addresses/amounts before sending
  (the script does), and the batcher reverts atomically, so no partial-payment state.
- Requires a one-time max approval from the relayer to the batcher per token. The
  batcher is immutable, owner-only, and has a `rescue()` escape hatch. Max approval
  is also what makes it cheap: USDC/OpenZeppelin tokens skip the allowance SSTORE
  write when allowance is `type(uint256).max` (~5,000 gas/payment saved).

**Shipped:** `src/BatchTransfer.sol`, `test/BatchTransfer.t.sol` (7 tests passing,
gas benchmark included), `relayer/send.mjs` (`approve` / `estimate` / `send`),
`relayer/verify.mjs`. Deploy:

```bash
forge create src/BatchTransfer.sol:BatchTransfer --private-key $KEY --rpc-url https://mainnet.base.org
export BATCHER_ADDRESS=0x... TOKEN_ADDRESS=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913  # USDC
node relayer/send.mjs approve                     # one-time, per token
node relayer/send.mjs estimate payments.json      # dry-run cost report
node relayer/send.mjs send payments.json          # broadcast
```

Batch size defaults to 50 (`BATCH_SIZE`). A 200-payment batch is ~5.6M gas — well
under Base's block limit — and amortizes the 21k intrinsic further; larger batches
just increase revert blast radius. 50 is a sane default.

### Change 2 — Stop overpaying the fee itself

Base has a near-zero priority-fee pattern and a 0.005 gwei base-fee floor. There is
no mempool auction to win. If the relayer currently uses legacy `gasPrice`,
`eth_gasPrice` padding, or a generous tip, it is donating money.

Correct params (implemented in `relayer/send.mjs`, re-read every batch):

```
maxPriorityFeePerGas = 0.001 gwei
maxFeePerGas         = 2 × current base fee + tip
```

Example: paying an effective 0.01 gwei when 0.006 gets you in the next block is a
40% overpay — that would be ~$5,700/year un-batched, ~$2,500/year after batching.
**Actual saving depends on current config — measure it (Change 4).**

### Change 3 — Timing around L1 data-fee spikes

The L1 data fee tracks Ethereum's fee market. Today it's ~$0.10/day total for us —
ignore it. During mainnet congestion it can become the dominant cost. If payouts
aren't latency-critical, hold batches when the GasPriceOracle
(`0x420000000000000000000000000000000000000F`) reports an elevated L1 fee and
drain the queue when it normalizes. **Value: ~$0 on a normal day, large on a spike
day. Pure policy — no code needed until spikes are actually costing us.**

### Change 4 — Replace assumptions with actuals (30 min, do first)

```bash
# For one day of relayer receipts, per tx:
#   actual_cost  = gasUsed × effectiveGasPrice
#   optimal_cost = gasUsed × (block.baseFeePerGas + 0.001 gwei)
# overpay_ratio  = Σ actual / Σ optimal
```

That ratio tells you exactly what Change 2 is worth, and the `gasUsed` distribution
tells you the real recipient mix (51k vs 65k) for the Change 1 math.

---

## 3. What I deliberately did *not* recommend

- **Golfing the token contract** — we don't control USDC's code. Irrelevant.
- **A different L2** — Base is already among the cheapest; migration cost dwarfs savings.
- **ERC-4337 / paymasters** — batching already captures the intrinsic-gas amortization;
  account abstraction adds overhead for this flow, it doesn't remove it.
- **Priority-fee "speed" tiers** — Base block time is 2s with a near-zero tip market.
  Paying more does not make payments faster.

## 4. Verification artifacts

- `forge test` — 7/7 passing, including `testBatchSavesAtLeast40Percent` (measured 64%)
- End-to-end on anvil: approve → estimate → 100 payments in 2 batches →
  `verify.mjs` confirmed 100/100 recipient balances.
- On-chain batch gas (1,382,890 / 50 payments) matched the Foundry measurement
  (1,382,295) within 0.05%.

## 5. Sources

- Base docs — network fees & 0.005 gwei minimum base fee (Jovian upgrade): docs.base.org
- ChainGate / gasfeepredictor Base trackers — ~0.006 gwei live, ERC-20 transfer ≈ 65k gas
- OpenChainBench — Base priority-fee-near-zero pattern
- ETH ≈ $2,500 (Coinbase/YCharts, Sept 2026)
- Gas measurements: `test/BatchTransfer.t.sol` in this repo
