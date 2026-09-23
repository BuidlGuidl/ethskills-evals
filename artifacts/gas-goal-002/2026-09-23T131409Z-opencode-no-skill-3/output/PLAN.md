# Gas plan — relayer ERC-20 transfers on Base

**Context:** ~40,000 ERC-20 transfers/day, all sent from one relayer wallet.
Every number below is reproducible with `node js/cost-model.js` (assumptions
printed inline; override any of them with `--set key=value`, or pull live
base fee / tip with `--rpc <your-base-rpc-url>`).

## What we spend today (baseline scenario)

| | per transfer | per day |
|---|---|---|
| Current (standalone txs, 0.1 gwei tip) | 6.51e12 wei | **0.260 ETH ≈ $859** |
| After lever 1 (tip control) | 1.78e12 wei | 0.071 ETH ≈ $235 |
| After levers 1+2 (tip control + packed batching) | 0.64e12 wei | **0.025 ETH ≈ $84** |

Baseline assumptions: L2 base fee 0.005 gwei, current tip 0.1 gwei (typical
wallet default), L1 data fee 13.6 gwei/byte (~$0.005 per standalone tx),
26,076 gas marginal execution per transfer (measured, see below), ETH $3,300.

**Before acting, measure our real tip from receipts** (`effectiveGasPrice −
block.baseFeePerGas`). It is the most sensitive input: if the relayer stack
falls back to ethers' 1.5 gwei default, lever 1 alone saves **2.86 ETH ≈
$9,445/day** instead of $624/day.

## Levers, ranked by savings (default scenario)

### 1. Priority-fee control — saves ~0.189 ETH ($624)/day [CODE: done, `js/fees.js`]

Base's sequencer is first-come-first-served; priority fees buy almost nothing.
Wallet/library defaults (0.1 gwei, or 1.5 gwei ethers fallback) are pure waste
at 40k tx/day. `js/fees.js` clamps the tip to [0.001, 0.1] gwei, sets
`maxFeePerGas = 2× baseFee + tip` with a 2 gwei ceiling, and handles +12.5%
replacement bumps. Zero risk to inclusion; this is config, not contracts.

### 2. Packed batching through `BatchTransfer.sol` — saves ~0.046 ETH ($151)/day on top of lever 1 [CODE: done]

One tx per 50 transfers instead of one per transfer amortizes:
- the 21,000-gas intrinsic (→ 420/transfer), and
- the L1 data fee (→ ~35 bytes/transfer vs ~110 standalone; packed
  `[address|uint96]` words are 32 bytes/transfer, half of a `address[]/uint256[]`
  batch).

Measured on the contract: 1,303,818 gas for 50 packed transfers to fresh
recipients = **26,076 gas/transfer marginal** (`forge test`). Batching is
worth ~$423/day even at today's tip. Deploy one contract, approve it per
token, and switch the relayer to `batchPacked` via `js/batch.js`
(`packTransfers`). Owner-only, USDT-safe (low-level call), uint96 supports
amounts up to ~7.9e28 base units.

### 3. Fee-window scheduling — saves ~0.001–0.011 ETH ($4–36)/day [ops, no code]

Base's base fee swings ~10x intraday. Deferring the delay-tolerant half of
volume to low-fee windows at a 40% average fee reduction yields the above.
Small in absolute terms — do it only after 1 and 2 ship.

## Sensitivity (why the ranking holds)

| scenario | lever 1 | lever 2 | lever 3 |
|---|---|---|---|
| default | $624/day | $151/day | $4/day |
| actual tip is 1.5 gwei (ethers fallback) | $9,445/day | $151/day | $4/day |
| base fee spiked to 0.05 gwei | $624/day | $275/day | $36/day |

Tip control dominates in every scenario. Batching's value scales with L2
congestion and L1 data costs, and it also cuts our RPC/ops overhead 50x.

## What NOT to do

- **Don't chase cheaper per-transfer execution gas.** The dominant marginal
  cost (~20,000 of the 26,076 gas) is the zero→nonzero SSTORE crediting fresh
  recipients — unavoidable, and identical standalone or batched.
- **Don't raise batch size past ~100** without checking L1 fee conditions; the
  per-transfer amortization has already flattened at 50 (rerun the model with
  `--set batchSize=100` to confirm).

## Shipped in this repo

| file | what |
|---|---|
| `contracts/BatchTransfer.sol` | batching contract (array + packed variants), tested |
| `test/BatchTransfer.t.sol` | Foundry tests incl. gas measurement — `forge test` |
| `js/fees.js` | Base EIP-1559 fee strategy + replacement bumps — `node --test js/*.test.js` |
| `js/batch.js` | packed-calldata encoder for `batchPacked` |
| `js/cost-model.js` | this plan's numbers — `npm run cost-model` |

## Rollout

1. Ship lever 1 (`js/fees.js`) this week — config-level, biggest win.
2. Deploy `BatchTransfer`, verify, approve tokens, shadow-run batches for a
   day, then cut over.
3. Re-run `node js/cost-model.js --rpc <url>` monthly to keep finance's
   numbers current.
