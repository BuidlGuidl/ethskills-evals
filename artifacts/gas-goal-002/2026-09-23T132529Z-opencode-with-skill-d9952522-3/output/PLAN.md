# Gas plan — 40k ERC-20 transfers/day on Base

All numbers measured live on 2026-09-23. Re-measure before quoting to finance;
gas prices and ETH/USD move.

## What we measured

| Quantity | Value | Source |
|---|---|---|
| Base gas price (base fee + suggested tip) | 0.006 gwei | `eth_gasPrice` @ mainnet.base.org |
| Base base fee | 0.005 gwei | latest block |
| ETH/USD | $2,712.95 | Coinbase spot |
| USDC transfer gasUsed (warm recipient) | 45,059 | on-chain receipt |
| USDC transfer gasUsed (cold recipient) | 62,159 | on-chain receipt |
| L1 data fee per transfer | ~3.2e-9 ETH (~$0.000009) | receipt `l1Fee`; cross-checked with GasPriceOracle.getL1Fee (2.9e-9 ETH) |

## What we spend today

Using 55,000 gas as the average transfer (mix of warm/cold recipients):

```
L2 execution: 55,000 × 0.006 gwei = 3.3e-7 ETH  ≈ $0.000895
L1 data fee:                          3.2e-9 ETH ≈ $0.000009
Total per transfer                              ≈ $0.00090
```

| Period | Cost |
|---|---|
| Per transfer | ~$0.0009 (range $0.00073–$0.00102 warm/cold) |
| Per day (40,000) | **~$36** |
| Per month | **~$1,080** |
| Per year | **~$13,200** |

**Cost split: L2 execution ≈ 99%, L1 data ≈ 1%.** Every optimization below
targets the execution component; the L1 data fee is negligible post-Dencun.

## Ranked plan

### 1. Audit and fix EIP-1559 fee fields — potential savings up to ~99%, $0 if already correct

This is first because it's the highest-variance item and costs nothing to check.
If the relayer hardcodes a gas price or ports a mainnet-style tip, the waste
dwarfs everything else:

| If relayer is set to | Cost/day | Waste/day |
|---|---|---|
| Measured-correct (0.006 gwei) | $36 | — |
| 0.1 gwei hardcode | $596 | ~$560 |
| 1 gwei (mainnet-style default) | $5,960 | ~$5,900 |

**Action:** check the relayer config today. Then make it structurally impossible
to misconfigure: derive fee fields from the chain at send time —
`tip = eth_gasPrice − baseFee`, `maxFeePerGas = 2 × baseFee + tip`. Never add a
tip on top of an `eth_gasPrice` reading (it already includes one).

**Shipped:** `relayer/fees.js` (zero-dependency, plain JSON-RPC). `node relayer/fees.js`
prints current fields; `getCastFeeArgs()` feeds them into `cast send`.

### 2. Batch payments through one contract — saves ~38–48% of execution gas, ~$470/month

Every standalone transfer pays the 21,000-gas intrinsic transaction cost plus
per-tx overhead. Batching N payments into one transaction amortizes that to
21,000/N. Measured in forge tests (worst case: all-cold recipients):

```
10 individual transfers: 74,700 gas/payment (incl. intrinsic)
1 batch of 10:           38,213 gas/payment (incl. intrinsic)
Savings:                 36,487 gas/payment ≈ 48%
```

Against the on-chain cold-recipient single (62,159 gas), batching saves
~24,000 gas/payment ≈ 38%:

```
24,000 gas × 0.006 gwei ≈ 1.44e-7 ETH ≈ $0.00039/payment
× 40,000/day ≈ $15.6/day ≈ $470/month ≈ $5,700/year
```

(Larger batches amortize further; 50/tx is the shipped default.)

**Shipped and tested:**
- `src/Batcher.sol` — owner-only batcher. The relayer approves it once with
  `type(uint256).max` (never decreases on spend, so it's a one-time cost);
  each payment is a `transferFrom(relayer, …)` inside one tx. A failing payment
  does **not** revert the batch — it's flagged in the return array and
  `Payment` event for off-chain reconciliation/retry. `onlyOwner` is
  load-bearing: without it, anyone could drain the relayer's allowance.
- `test/Batcher.t.sol` — 6 tests, all passing (`forge test`), including the
  gas comparison above and failure-isolation.
- `relayer/batchSend.js` — zero-dependency sender: reads a payments JSON file,
  chunks into batches, ABI-encodes by hand, gets fees from `fees.js`, signs and
  broadcasts via `cast send`. Verified end-to-end on a local anvil node
  (deploy → approve → batch of 7 → all balances correct, 1 tx).

**Rollout:** deploy Batcher from the relayer wallet → `node relayer/batchSend.js approve`
→ point the daily job at `node relayer/batchSend.js run payments.json`
(use `--dry-run` first). Reconcile `Payment` events; retry failures individually.

### 3. Explicitly skip: calldata compression / L1-fee tricks — saves at most ~$0.35/day

The L1 data fee is ~1% of total cost (~$10/month). Post-Dencun blob pricing made
calldata optimization a rounding error for this workload. Not worth engineering
time. (Pre-Dencun advice saying otherwise is stale.)

### 4. Context for finance: staying on Base vs mainnet — ~$1,940/day avoided

For the same workload on mainnet (measured 0.332 gwei):

```
55,000 × 0.332 gwei ≈ 1.83e-5 ETH ≈ $0.0495/transfer → ~$1,980/day
```

Base at ~$36/day is ~55× cheaper. Base is the right chain for high-frequency,
low-value payments; no migration analysis needed.

## Bottom line

| Change | Savings | Effort |
|---|---|---|
| 1. Fix fee fields if misconfigured | $0 – $5,900/day (audit first) | minutes |
| 2. Batch via Batcher.sol | ~$15.6/day (~$5,700/yr), ~38–48% of remaining | shipped, needs deploy |
| 3. L1 calldata tricks | ~$0.35/day — skip | — |
| 4. (Already on Base vs mainnet) | ~$1,940/day avoided | none |

If the fee audit comes back clean, realistic floor after batching is
**~$20/day (~$7,400/yr)** at current prices.
