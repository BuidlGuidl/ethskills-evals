# Gas Plan — 40k ERC-20 transfers/day on Base

All numbers below were measured live on Base mainnet on 2026-09-23 (~12:40 UTC).
Rerun any time with `npm run report` — nothing in the pipeline is hardcoded.

## What we measure now

| Quantity | Value | Source |
|---|---|---|
| Base base fee | 0.005 gwei (flat over last 30 blocks) | `eth_feeHistory`, Base RPC |
| Suggested tip p25 / p50 / p75 | 0.000375 / 0.0011 / 0.006 gwei | `eth_feeHistory`, Base RPC |
| Fair all-in gas price | ~0.0054–0.006 gwei | base fee + p25 tip |
| ETH/USD | $2,725.86 | Chainlink mainnet feed |
| Reference transfer gas | 62,159 | Real USDC transfer receipt `0x6bef4e25…cde5`, block 51688771 |
| L1 data fee per transfer | 3.2e-9 ETH (**0.95%** of total cost) | GasPriceOracle `getL1Fee` + receipt `l1Fee` |

**Current spend (if our fees are set correctly):** ~$0.00092/transfer →
**$36.78/day → $13,424/yr.**

An OP-stack receipt has two cost components: `gasUsed × effectiveGasPrice`
(L2 execution) and `l1Fee` (L1 data posting). We measured both: L1 data is
under 1% of our cost right now (blob fees near floor), so **calldata
compression tricks are not worth engineering time today** — execution gas and
fee settings are where the money is. (Measured, not assumed: that 1% can grow
under L1 congestion; the report script tracks it.)

One warning from the wild: a real relayer transaction in that same block paid
an **effective 0.31 gwei on a block with a 0.005 gwei base fee** (block only
10.9% full) — a 60x overpayment, the classic "ported a mainnet tip constant to
an L2" bug. At our volume that failure mode is **~$2,100/day**. Item 2 below
exists so that can never be us.

## The plan, ranked by savings

### 1. Batch transfers through BatchTransfer.sol — saves ~$24.88/day ($9.1k/yr), ~68% of spend. SHIPPED.

Every standalone transfer pays a 21,000-gas intrinsic transaction fee plus its
own L1 envelope. Batching N transfers into one transaction pays that once.

Measured in `forge test` (representative ERC-20, recipients with existing
balance slots — the payments-app case):

- Standalone `transfer()` execution: **44,796 gas** (+21k intrinsic +calldata)
- Batch marginal cost per transfer: **11,716 gas**
- Per-transfer batched total incl. intrinsic share and calldata: **~13,100 gas**

We plan against a conservative **20,000 gas/transfer** (real tokens add
blacklist/compliance checks; some recipients are cold). At 20k:

- Batched cost: $0.000297/transfer → **$11.90/day vs $36.78/day**
- Savings scale linearly with the base fee — if Base fees 10x, this item alone
  saves ~$250/day.

Shipped: `contracts/BatchTransfer.sol` (owner-only, atomic, allowance-based —
never custodies funds), wired into `src/relay.mjs` which groups the queue by
token and flushes at 50 payments or 5s. Deploy: `node src/relay.mjs deploy`,
then one-time `node src/relay.mjs approve <token>` per token (costs ~$0.001
once, and max-allowance means `transferFrom` skips the allowance SSTORE on
every subsequent payment).

### 2. Derive EIP-1559 fees at submission, never hardcode — $0 if we're already optimal; up to ~$38/day if we pay p75-style tips; kills the 60x-overpay tail risk. SHIPPED.

Measured market spread right now: p25 tip 0.000375 gwei vs p75 tip 0.006 gwei.
**Every 0.01 gwei of unnecessary tip costs $67.77/day ($24.7k/yr) at 40k
transfers.** A hardcoded "safe" 0.05 gwei priority fee — a common mainnet
habit — would be ~$300/day of pure waste on Base today.

Shipped: `deriveFees()` in `src/relay.mjs` computes, at submission time,
`tip = p25 of last 30 blocks` and `maxFeePerGas = 2 × baseFee + tip`
(headroom absorbs base-fee drift while pending; only baseFee + tip is ever
paid). Nothing is hardcoded or ported from mainnet.

### 3. Base-fee spike gate for non-urgent sends — $0 at today's flat 0.005 gwei; caps worst-case spend. SHIPPED.

Fees are at the floor right now, so this saves nothing today — it is insurance.
If a spike pushes the base fee above `BASE_FEE_GATE_GWEI` (default 0.05 gwei,
10x current), the relayer holds the queue and flushes when fees calm. Payroll-
style payments that tolerate minutes of delay ride out spikes; at 40k/day a
one-hour 0.5 gwei spike otherwise costs an extra ~$2,800.

Shipped: `waitForCalmFees()` in `src/relay.mjs`.

### 4. Receipt-based cost accounting — turns "what do we spend" into a query, not a guess. SHIPPED.

Every confirmed transaction is appended to `cost-log.csv` with `gasUsed`,
`effectiveGasPrice`, and the receipt's `l1Fee` — actual paid cost, both OP-stack
components. `npm run report` re-measures live conditions and prints
per-transfer / per-day / per-year figures for standalone vs batched. Finance
gets a number that updates itself.

## One-time costs

- Deploy `BatchTransfer`: ~500k gas ≈ $0.007 at current fees.
- `approve` per token: ~46k gas ≈ $0.001 each.

## Caveats (so finance trusts the table)

- All dollar figures are at **measured current conditions**: 0.005 gwei base
  fee, ETH $2,725.86. Both move; the gas *ratios* (68% batching cut) are
  structural, the dollar figures are a snapshot. `npm run report` refreshes.
- 62,159 gas is a real measured USDC transfer. Transfers to brand-new
  addresses (fresh storage slot) cost more (~75–80k); transfers to zero-balance
  existing slots less. Our batching savings hold across all three cases because
  the intrinsic/envelope amortization is what dominates.
- The 20,000 gas/transfer batched figure is deliberately padded over the
  measured 13,100. Real-world results will land between; the cost log (item 4)
  will show the true number within a day of shipping.

## Files

| File | What it is |
|---|---|
| `contracts/BatchTransfer.sol` | Batch payment contract (item 1) |
| `test/BatchTransfer.t.sol` | Gas measurements + correctness (`forge test -vv`) |
| `src/relay.mjs` | Relayer: batching, fee derivation, spike gate, cost log (items 1–4) |
| `src/cost-report.mjs` | Live measurement → dollars (`npm run report`) |
