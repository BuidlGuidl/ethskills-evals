# Chain recommendation: freelance escrow ($2,000–$50,000 per job)

**Recommendation: deploy on Ethereum mainnet.** Gas cost is not the deciding
factor here — at the value per job you described, fees are rounding error on
every chain considered, so the choice should be made on settlement and custody
properties, and those favour L1. Base is the fallback if the job mix shifts
cheap and high-volume.

All figures below were measured on 2026-09-23, not recalled.

## Measurements

ETH/USD: **$2,734.46** (Chainlink `0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419`,
`latestRoundData`, 8 decimals; cross-checked against Coinbase spot at $2,733.85).

Gas price (`cast gas-price`, base fee + suggested tip, converted from wei):

| Chain | wei | gwei |
|---|---:|---:|
| Ethereum mainnet | 316,678,828 | 0.3167 |
| Base | 6,000,000 | 0.0060 |
| Arbitrum One | 20,222,000 | 0.0202 |
| OP Mainnet | 1,000,578 | 0.0010 |

The mainnet reading is low enough to be worth double-checking, so it was:
drpc returned 336,071,598 wei, and the last five sampled base fees were
336.0 / 373.6 / 336.7 / 292.0 / 305.0 Mwei (≈0.29–0.37 gwei). It is a real
level, not a momentary dip.

OP-stack L1 data fee, read off recent receipts (not estimated): Base
≈ 3.0e-9 ETH/tx, OP Mainnet ≈ 4.7e-9 ETH/tx — about **$0.00001 per
transaction**. Post-Dencun the L1 component is negligible here; L2 execution,
not calldata, is what you would be optimizing if you optimized anything.

## Gas used

Measured from an actual minimal escrow (`fund` / `release` / `dispute` /
`resolve`, ERC-20 denominated) compiled and gas-reported under Foundry:
deployment 973,833; `fund` 122,031; `release` 63,534; `dispute` 29,191;
`resolve` 44,662.

The figures below round those up to allow for real USDC (allowance decrement,
slightly heavier storage) rather than the test mock: deploy 1,000,000,
`approve` 46,000, `fund` 130,000, `release` 70,000, `dispute` 30,000,
`resolve` 55,000. Happy path = approve + fund + release = **246,000 gas**.

## Cost per job

`cost_usd = gas_used × gas_price_gwei × 1e-9 × eth_usd`, plus `l1_fee` on the
OP-stack chains.

| | Ethereum | Base | Arbitrum | OP Mainnet |
|---|---:|---:|---:|---:|
| Deploy (1,000,000) | $0.87 | $0.0164 | $0.0553 | $0.0027 |
| `approve` (46,000) | $0.0398 | $0.0008 | $0.0025 | $0.0001 |
| `fund` (130,000) | $0.1126 | $0.0021 | $0.0072 | $0.0004 |
| `release` (70,000) | $0.0606 | $0.0012 | $0.0039 | $0.0002 |
| `dispute` (30,000) | $0.0260 | $0.0005 | $0.0017 | $0.0001 |
| `resolve` (55,000) | $0.0476 | $0.0009 | $0.0030 | $0.0002 |
| **Happy path (246,000)** | **$0.2130** | **$0.0041** | **$0.0136** | **$0.0007** |
| Dispute path (206,000) | $0.1784 | $0.0034 | $0.0114 | $0.0006 |

As a share of your **smallest** job ($2,000), where fees bite hardest:

- Ethereum: 0.0107%
- Arbitrum: 0.0007%
- Base: 0.0002%
- OP Mainnet: 0.00003%

On a $50,000 job, mainnet's full round trip is 0.0004% of the escrowed amount.

## Reasoning

**Cost does not exclude mainnet, so it should not drive the decision.** The L2s
are 15–300× cheaper in relative terms, but the absolute gap on a single job is
about **21 cents**. Nothing in a $2,000–$50,000 escrow business is decided by
21 cents. Choosing an L2 here on cost grounds would be optimizing a line item
that is three to four orders of magnitude below the value at risk — and well
below the payment-processing, compliance, and dispute-handling costs you will
actually carry.

**The workload profile points at L1.** Escrow is low-frequency and high-value:
roughly three transactions per job, each moving thousands of dollars, none
latency-sensitive (nobody needs sub-second confirmation to release a milestone).
That is the pattern where mainnet stays the right default. The L2 case is
high-frequency, low-value, latency-sensitive, or L2-native activity, and this
is none of those.

**What actually differs is custody risk, and mainnet wins it.** Your contract
holds real money for the duration of a job — days to weeks. On a rollup that
custody inherits sequencer liveness, the upgrade keys of the rollup's security
council, and a withdrawal path to L1 (seven days on optimistic chains) that
matters exactly when something has gone wrong and a client wants their $50,000
back. On mainnet the held funds have Ethereum's own finality and nothing else
in the trust path. You also get the deepest USDC liquidity, and the broadest
tooling for the parts of this system that matter most — multisig or institutional
custody for the arbiter key, insurance, audit familiarity, and fiat on/off-ramps
that settle natively rather than via a bridge.

**Gas-price headroom.** Mainnet gas is volatile, so the recommendation was
stress-tested rather than taken at today's 0.32 gwei:

| Mainnet gas price | Happy path | % of $2,000 job | Deploy |
|---:|---:|---:|---:|
| 0.32 gwei (today) | $0.22 | 0.011% | $0.88 |
| 5 gwei | $3.36 | 0.168% | $13.67 |
| 20 gwei | $13.45 | 0.673% | $54.69 |
| 50 gwei | $33.63 | 1.682% | $136.72 |
| 100 gwei | $67.27 | 3.363% | $273.45 |

Mainnet stays comfortable through roughly 20 gwei even on your smallest job.
It only becomes uncomfortable at 50–100 gwei against a $2,000 job — and at
$50,000 it never does (0.13% even at 100 gwei). Since `release` is not
time-critical, a fee-aware release that waits out a spike absorbs most of that
tail on its own.

## When to pick Base instead

Switch if any of these is true, and they are business facts you know better
than I do:

1. **Job sizes drift down.** If you end up serving $50–$200 microtasks, the
   ratio flips and mainnet's 0.011% becomes a few percent.
2. **Volume is high and you subsidize gas.** If you sponsor fees for thousands
   of jobs a month, $0.21 vs $0.004 per job is a real line item — at 50,000
   jobs/month that is ~$10,600 vs ~$205.
3. **Your users already live on an L2.** Making clients bridge $50,000 to fund
   a job is worse UX and worse risk than anything you save on gas. Meet them
   where their USDC already is.

If you go that route, Base over OP Mainnet or Arbitrum: not for the fee
difference (all three are noise) but for USDC issuance and on-ramp depth.

## Implementation notes

- Derive `maxFeePerGas` / `maxPriorityFeePerGas` from the target chain right
  before each submission. Do not hardcode the 0.32 gwei above; it will be wrong
  by the time you ship, and a mainnet priority-fee constant is meaningless on
  an L2.
- If you do deploy to an OP-stack chain, do not preemptively optimize calldata.
  Measured today, `l1Fee` is ~0.1–1% of the total on Base and OP — execution
  dominates. Re-measure `gasUsed × effectiveGasPrice` against `l1Fee` before
  optimizing anything.
- Deployment cost is a one-time $0.87 on mainnet at current gas. It is not a
  factor in this decision on any chain.
