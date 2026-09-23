# Chain recommendation: freelance escrow ($2k–$50k per job)

**Recommendation: Base.** But not for the reason you probably expect — and the
reason most people would give is factually wrong today. See "The cost argument
doesn't decide this" below.

All numbers measured **2026-09-23**, not recalled. Re-measure before you commit
to anything; gas prices and ETH/USD move.

---

## 1. Measurements

### Prices (live)

| Reading | Value | Source |
|---|---|---|
| ETH/USD | **$2,730.75** | Coinbase spot |
| ETH/USD (cross-check) | $2,734.46 | Chainlink `ETH/USD` `0x5f4e…8419`, `latestRoundData` |
| Ethereum mainnet gas price | **0.364 gwei** (364,345,354 wei) | `cast gas-price`, publicnode |
| — sampled over ~10 min | 0.287 → 0.369 → 0.364 gwei | repeated sampling |
| Mainnet base fee | 0.323 gwei | `cast base-fee` |
| Base gas price | **0.00601 gwei** (6,000,000 wei) | `cast gas-price`, mainnet.base.org |
| OP Mainnet gas price | **0.001001 gwei** (1,000,565 wei) | `cast gas-price` |
| Arbitrum One gas price | 0.02 gwei (20,000,000 wei) | `cast gas-price` |

Note the mainnet number: **sub-1 gwei**. Ethereum L1 is not expensive right now.

### Gas used (measured, not assumed)

I wrote a realistic escrow (`fund` / `release` / `refund` / `dispute` /
`resolve`, USDC-denominated, packed `Job` struct) and measured it against
**real USDC** (`0xA0b8…eB48`) on a mainnet fork — not a mock, because the mock
understates `transferFrom` by ~12k gas.

| Operation | Execution gas | + 21k intrinsic + calldata | Total tx gas |
|---|---|---|---|
| `fund` (escrow created, USDC pulled in) | 156,341 | +21,000 +959 | **178,300** |
| `release` (pay the freelancer) | 70,932 | +21,000 +204 | **92,136** |
| **Happy-path job (`fund` + `release`)** | | | **270,436** |
| `refund` | 49,847 | | ~71,000 |
| `dispute` | 31,832 | | ~53,000 |
| `resolve` | 55,224 | | ~76,500 |
| Contract deployment | | `cast estimate --create` | **1,318,212** |

Deployed bytecode: 5,802 bytes. `fund` is the expensive one because it writes a
fresh `Job` slot (cold SSTORE) *and* does a USDC `transferFrom`.

### L1 data fee (OP-stack — measured separately, per the fee model)

`GasPriceOracle.getL1Fee` at `0x4200…000F`, for a ~250-byte signed tx and a
~6,420-byte deployment:

| Chain | L1 fee, 250B tx | L1 fee, deploy |
|---|---|---|
| Base | 0.000000007267 ETH ($0.0000198) | 0.000000175 ETH ($0.00048) |
| OP Mainnet | 0.000000010393 ETH ($0.0000284) | 0.000000251 ETH ($0.00068) |

Which component dominates differs by chain — I checked real recent receipts:

- **Base**, live receipt: `gasUsed` 1,936,992 @ 0.00601 gwei → execution
  0.00001164 ETH, `l1Fee` 0.0000000413 ETH → **L1 data is 0.4%** of the bill.
  On Base, execution gas dominates; shrinking calldata is the wrong optimization.
- **OP Mainnet**, live receipt: execution 0.0000000006 ETH, `l1Fee`
  0.0000000548 ETH → **L1 data is 98.9%**. Opposite conclusion on a sister chain.

This is why the L1 fee has to be read, not estimated.

---

## 2. Cost per job

`cost_usd = gas_used × gas_price_gwei × 1e-9 × eth_usd` (+ `l1_fee_eth × eth_usd` on OP-stack)

| Chain | Deploy (once) | `fund` | `release` | **Per job** |
|---|---|---|---|---|
| Ethereum mainnet | $1.3103 | $0.1772 | $0.0916 | **$0.2688** |
| Base | $0.0221 | $0.0029 | $0.0015 | **$0.0045** |
| OP Mainnet | ~$0.008 | $0.0005 | $0.0003 | **$0.0008** |
| Arbitrum One | — | ~$0.0097 | ~$0.0050 | **~$0.0148*** |

\* Arbitrum is not OP-stack and uses a different fee model — its reported
`gasUsed` already embeds an L1 surcharge, so this execution-only figure is a
floor. Measure Arbitrum independently before relying on it.

---

## 3. The cost argument doesn't decide this

Per-job cost as a fraction of the escrowed amount, **on mainnet, right now**:

| Job size | Mainnet cost | % of job |
|---|---|---|
| $2,000 | $0.27 | **0.013%** |
| $50,000 | $0.27 | **0.0005%** |

Your payment processor charges 2.9%. Mainnet charges 0.013% on your *smallest*
job. "Ethereum is too expensive for this" is simply not true at 0.364 gwei —
anyone who tells you to leave mainnet on cost grounds is quoting a remembered
gas price from a different market. The absolute saving from moving to Base is
**26 cents per job**. That is not a business reason.

What *does* matter is that the mainnet number is **volatile and unbounded**, and
you don't control when your users transact:

| Mainnet gas | Per job | % of a $2,000 job | % of a $50,000 job |
|---|---|---|---|
| 0.364 gwei (today) | $0.27 | 0.013% | 0.0005% |
| 5 gwei | $3.69 | 0.185% | 0.007% |
| 30 gwei (busy day) | $22.15 | **1.11%** | 0.044% |
| 100 gwei (NFT mint / depeg panic) | $73.85 | **3.69%** | 0.148% |

Base at **100× its current gas price** (0.6 gwei) still costs $0.44 per job.

So the real asymmetry is variance, not level. On a $50,000 job mainnet is fine
in every scenario — even at 100 gwei it's 0.15%. On a $2,000 job at 100 gwei,
`release` alone costs a freelancer ~$25 to collect their money, at exactly the
moment they're least willing to tolerate it.

---

## 4. Why Base specifically

Cost ranks these chains OP Mainnet < Base < Arbitrum < mainnet, and OP is ~5×
cheaper than Base. That difference is $0.004 per job — noise. So pick on
everything else:

1. **Off-ramp.** This is the decisive one. Freelancers need to turn USDC into
   rent money. Base has native USDC and direct Coinbase account integration;
   your users can cash out without touching a bridge. On a freelance-payments
   product, withdrawal friction is the product.
2. **Cost predictability.** Base's per-job cost is stable in the sub-cent range
   and stays there under 100× stress. You can quote a flat platform fee and
   never revisit it.
3. **Latency.** ~2s blocks. "Release" should feel instant to someone who just
   delivered work.
4. **Native USDC on all four**, so that's not a differentiator — but Base's
   liquidity plus the Coinbase on-ramp is.

### The honest case against Base

You're holding up to $50,000 for weeks. That exposes you to L2-specific risk
mainnet doesn't have: a centralized sequencer, an upgradeable bridge, and a
7-day withdrawal window if you ever need to exit to L1. Those risks are small
and getting smaller, but they are not zero, and they scale with the amount held
— which is the whole point of your product.

If your volume is genuinely low-frequency and skewed toward the $50k end,
**mainnet is a defensible choice and I would not argue with it**: 2–3
transactions per job over a multi-week period is exactly the low-frequency,
high-value pattern L1 is good at, the cost is 0.0005% of the job, and you get
credible neutrality on the held funds for free.

**A reasonable split:** deploy on Base as the default, and offer a mainnet
deployment of the same contract for jobs above some threshold (~$25k), where
$0.27–$22 is irrelevant and the counterparty would rather have L1 settlement
guarantees. Same bytecode, both chains.

---

## 5. Implementation notes

- **Set EIP-1559 fields from the target chain at submission time.** Read
  `cast base-fee` on Base immediately before sending; do not hardcode, and do
  not port a mainnet priority-fee constant over — Base's whole gas price
  (0.006 gwei) is ~60× *smaller* than a typical mainnet tip.
- **Don't optimize calldata on Base.** L1 data is 0.4% of the bill there;
  execution gas is 99.6%. If you want to cut costs, cut the SSTOREs in `fund`.
  If you ever deploy to OP Mainnet, the reverse holds (98.9% L1 data) — so this
  optimization decision must be re-measured per chain, not carried across.
- **`fund` is 66% of the per-job cost.** The `Job` struct is already packed into
  2 slots. Batching multiple job creations per tx would amortize the 21k
  intrinsic, but at $0.003/job there is no reason to bother.
- **Re-measure before launch.** Every figure here is a 2026-09-23 snapshot.
