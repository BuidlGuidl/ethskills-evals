# Gas plan — Base relayer, 40k ERC-20 transfers/day

All numbers below were measured live on 2026-09-23 (~13:10 UTC), not from
memory. Re-pull them any time with:

```
npm run measure                                      # market snapshot
RELAYER_ADDRESS=0x<relayer> npm run measure          # our actual recent spend
```

## What we measured

| Reading | Value | Source |
|---|---|---|
| ETH/USD | $2,709 | Coinbase spot |
| Base base fee | 0.0051 gwei — pinned at its 0.0050 floor for 600+ consecutive blocks | `eth_getBlockByNumber` |
| Sequencer-suggested tip | 0.0010 gwei | `eth_maxPriorityFeePerGas` |
| ERC-20 transfer gas used | avg 48,571 (45k warm recipient slot, 62k fresh slot) — 40 sampled USDC transfer receipts | `eth_getTransactionReceipt` |
| L1 data fee per transfer | ~4.09e-9 ETH (≈$0.000011) | `l1Fee` on those receipts |
| **What senders actually paid** | **0.0051–0.5001 gwei effective, avg 0.0314** | same receipts |
| Mainnet gas price (context) | 0.442 gwei | publicnode |

Cost model (OP-stack): `cost = gasUsed × effectiveGasPrice + l1Fee`.

**Baseline: what disciplined sending costs today** — base fee 0.0051 + tip
0.001 = 0.0061 gwei:

```
48,571 gas × 0.0061 gwei = 2.96e-7 ETH ≈ $0.0008/tx
+ L1 data fee           ≈ $0.000011/tx   (1.4% of the total)
× 40,000/day            ≈ $32.5/day ≈ $975/month
```

The L1 blob fee is a rounding error; **execution gas × the price we choose to
pay is 98.6% of spend.** That's what the plan targets.

## Ranked by savings

### 1. Fee policy: derive fees live, tiny tip, hard caps — ships now

**Saves up to ~$133/day (~$3,990/mo, ~80%) if we currently pay like the
average sampled sender. If we already send at the suggested fee, it saves
~$0 and instead locks the discipline in and caps worst-case.**

Evidence: in a congestion-free window with a flat 0.0050 gwei base fee, real
senders paid effective prices from 0.0051 to 0.5001 gwei (avg 0.0314). The
entire spread is priority-fee overpayment — the base fee didn't move. Wallet
defaults and hardcoded mainnet-style tips are why.

Rule of thumb for finance: every 0.01 gwei of unnecessary effective price =
`40,000 × 48,571 × 0.01 gwei × $2,709` ≈ **$52.6/day ≈ $1,580/mo**.

Shipped code:

- `src/fees.ts` — policy: `maxFeePerGas = 2 × baseFee + tip`, tip capped at
  0.001 gwei, base-fee cap 0.01 gwei, absolute ceiling 0.05 gwei. Inputs are
  read from the chain immediately before signing (`decideFeesLive`), never
  hardcoded. When caps trip, the decision is **hold and retry**, never
  overpay.
- `src/transfer.ts` — builds the unsigned EIP-1559 transfer with those fee
  fields; our existing signer fills nonce/gasLimit and signs.

Effort: hours. Risk: none — standard EIP-1559 semantics.

### 2. Batch transfers through a helper contract — deploy this week

**Saves ~16,900 gas/transfer (~35% of execution) at 10 transfers/tx ≈
$11/day (~$334/mo) at disciplined fees — and scales up with whatever fee
level is in force when item 1 lands (≈$57/day at the sampled average fee).**

Mechanics: a standalone tx pays a 21,000-gas intrinsic plus a fixed L1 data
overhead. Batching N transfers into one tx pays those once. Net of ~2,000
gas/item loop overhead: `(21,000 × (N−1)/N) − 2,000` ≈ 16,900 gas saved per
transfer at N=10 (18,790 at N=100). It also cuts the (tiny) L1 fee by ~60%.

Shipped code:

- `contracts/Batcher.sol` — pull-based batcher (compiles clean under
  `forge build`). It never custodies funds: the relayer grants it a token
  allowance once (~46k gas, one time) and each batch does
  `transferFrom(relayer, recipient[i], amount[i])`. A bad transfer reverts
  the whole batch — atomic settlement, which is the semantics a payments app
  usually wants.
- `src/batch.ts` — calldata encoder (verified byte-for-byte against
  `cast calldata` fixtures in tests), gas-savings model, and the same
  fee-disciplined tx builder.

Caveats: not for fee-on-transfer/rebasing tokens (amounts are exact);
latency becomes "next batch window" instead of immediate; one-time deploy +
allowance setup.

### 3. Congestion queue guard — config, already in `src/fees.ts`

**Saves $0 today; it's insurance.** Base's base fee is at its floor now, but
it has spiked before. With `baseFeeCapWei = 0.01 gwei`, non-urgent transfers
queue instead of chasing a spike: at a 0.05 gwei spike that's
`48,571 × 0.04 gwei ≈ $0.0053/tx` avoided ≈ **$211/day of spike exposure
removed**. Trade-off is payment latency, so the cap should be per priority
class (instant payouts bypass it, bulk payouts respect it).

### Explicitly not doing

- **Chasing the L1 data fee** — 1.4% of spend ($0.44/day). No calldata trick
  pays for itself.
- **Moving to mainnet** — measured 0.442 gwei today: the same transfer would
  cost ~$0.058 → **~$2,330/day, ~72× Base**. Base is the right chain.
- **Token-level tricks** — gas used is dominated by the token contract's own
  storage writes; not ours to optimize.

## Projected result

Items 1+2 at current prices: **~$21/day (~$640/mo)** vs ~$165/day at the
fee levels the average sampled sender pays — an ~87% reduction, with item 3
capping tail risk during fee spikes.

## Verification

- `npm test` — 9 tests: fee-policy math (floor, spike-cap, hold paths) and
  ABI encoders pinned to `cast calldata` fixtures. All passing.
- `contracts/Batcher.sol` compiles under `forge build`.
- `npm run measure` — the table above, generated live at run time.
