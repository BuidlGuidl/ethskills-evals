# Gas Plan — Base Payments Relayer (40k ERC-20 transfers/day)

All numbers measured live on **2026-09-23**: Base base fee **0.005 gwei**, priority fee
**~0.001 gwei**, L1 blob base fee **~0.018 gwei**, ETH **$2,721** (Chainlink on Base).
Execution gas measured with `forge test` against a USDC-like token; L1 data fees from
Base's GasPriceOracle (`getL1Fee`). Reproduce any time with `npm run quote`.

## What we spend today

| | gas/payment | cost/payment | per day (40k) | per year |
|---|---|---|---|---|
| Single transfer, existing holder | 54,928 | $0.000905 | $36.21 | **$13,217** |
| Single transfer, fresh address | 76,531 | $0.001258 | $50.32 | **$18,368** |

Reality is between the two rows depending on what fraction of recipients already hold
the token. L1 data fees are currently <1% of the total (blobs are cheap post-Pectra/Fusaka);
L2 execution gas is ~99% of the bill.

## Ranked changes

### 1. Batch transfers — saves ~$10,300–13,000/year (71–78%) — IMPLEMENTED

One transaction fans out 25 payments via `contracts/BatchTransfer.sol` instead of 25
separate transactions. Amortizes the 21,000-gas intrinsic cost and per-tx L1 data
overhead across the batch.

| | gas/payment | cost/payment | per year | savings vs single |
|---|---|---|---|---|
| Batch of 25, existing holder | 12,246 | $0.000200 | $2,926 | **$10,291/yr (78%)** |
| Batch of 25, fresh address | 22,506 | $0.000368 | $5,372 | **$12,996/yr (71%)** |

Bonus: batching cuts the L1 data fee per payment ~22x (measured via the oracle:
2.87e9 wei → 1.29e8 wei). That's negligible today but is the hedge for when L1 fees
spike — see #3.

Ship it:
1. Deploy: `forge create contracts/BatchTransfer.sol:BatchTransfer --rpc-url $BASE_RPC_URL --private-key $DEPLOYER_KEY` (~$0.01)
2. One-time per token, from the relayer: `approve(batchContract, type(uint256).max)` (~$0.001)
3. Export payments as `[{"to":"0x...","amount":"1000000"}]`, then:
   `node src/relayer.js payments.json` (dry run) → `node src/relayer.js payments.json --send`

Contract risk: 20 lines, no custody — each leg is a `transferFrom` inside one atomic tx.
The only standing permission is the approval, revocable at any time. One bad leg (e.g. a
USDC-blocked recipient) reverts the whole batch by design; the relayer aborts loudly so
the bad payment can be isolated and the rest rerun. Verified end-to-end on a local chain.

### 2. Audit the relayer's fee settings — up to $3.3M/year if misconfigured — IMPLEMENTED

This is the classic relayer bug: mainnet-era defaults hardcoded into fee config. On Base
today the correct priority fee is ~0.001 gwei. What common settings actually cost at our
volume (54,928 gas/transfer):

| hardcoded priority fee | cost/transfer | per day | per year |
|---|---|---|---|
| 1.5 gwei (old ethers default) | $0.224 | $8,970 | **$3,273,000** |
| 0.1 gwei | $0.0149 | $598 | $218,000 |
| 0.01 gwei | $0.0015 | $60 | $21,800 |
| ~0.001 gwei (correct, live) | $0.00015 | $6 | $2,190 |

Ranked #2 only because we don't know the current config — if it's wrong, this is bigger
than #1 by an order of magnitude. `src/fees.js` implements the correct policy:
live `eth_maxPriorityFeePerGas` clamped to [0.0005, 0.01] gwei, `maxFee = 2×baseFee +
priority`, hard cap 1 gwei. On Base inclusion is essentially first-come-first-served;
large tips buy nothing.

### 3. Spike deferral — tail-risk insurance — IMPLEMENTED

Base fees occasionally spike 20–200x for minutes-to-hours (viral mints, airdrops). At
1 gwei base fee, one transfer costs $0.149 — sending 40k through a one-day spike is
$5,980 burned. `src/fees.js` throws when base fee exceeds 0.1 gwei (20x normal) and
`src/relayer.js` waits and retries instead of sending into the spike. Steady-state
savings ≈ 0; expected value is capping the worst day of the year at ~$0 extra.

### 4. Measure actual spend — answers finance's question — IMPLEMENTED

- `node src/report.js <relayerAddress> --blocks 1000` — sums real spend from receipts:
  `gasUsed × effectiveGasPrice` (L2 execution) + `l1Fee` (L1 data, OP Stack receipt
  field). Reports ETH + USD, per-tx average, failed-tx count (reverts still burn gas —
  worth alerting on), and a daily/monthly run-rate. Point `BASE_RPC_URL` at an archive
  node with `--from/--to` for full history, or use Basescan/Dune for dashboards.
- `npm run quote` — live unit economics (the tables above, regenerated from chain data).

### 5. Considered and rejected

- **Move to another L2** — Base is already at the L2 floor (~$0.001/transfer); Arbitrum
  and zkSync are within 2x. Migration cost dwarfs any saving.
- **Move to mainnet** — ~13x more expensive per transfer ($0.013 vs $0.001). No.
- **Intraday fee timing** — Base fees are flat enough that scheduling sends for "cheap
  hours" saves <5%. Not worth the complexity; spike deferral (#3) captures the real wins.
- **EIP-7702 batching from the relayer EOA** — viable post-Pectra and avoids a deployed
  contract, but needs wallet/client support for authorization signing. The batch contract
  (#1) ships today with zero infra changes. Revisit if we ever rotate relayer architecture.

## Bottom line for finance

| scenario | annual gas spend |
|---|---|
| Today (40k single transfers/day) | $13,200–18,400 |
| After batching (#1) | $2,900–5,400 |
| After batching + verified fee config (#1+#2) | **$2,900–5,400, guaranteed not to be silently 100x higher** |

Operational note: after batching, a year of gas is ~1–2 ETH. Keep the relayer topped to
~0.5 ETH and alert below 0.2 ETH.

## Files

- `contracts/BatchTransfer.sol` — batch dispatcher (deploy + approve once)
- `test/BatchTransfer.t.sol` — gas measurements (`forge test -vv`)
- `src/fees.js` — fee policy: live priority fee, caps, spike detection
- `src/relayer.js` — batching sender with spike retry, dry-run default
- `src/report.js` — actual spend report from receipts
- `src/quote.js` — live per-transfer cost quote
