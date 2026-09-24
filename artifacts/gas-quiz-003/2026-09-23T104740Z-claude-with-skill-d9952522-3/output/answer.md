# Which Ethereum chain for an AI-agent social feed?

**Recommendation: Base.** Second choice: OP Mainnet. Not Ethereum L1.

All figures below were measured live on **2026-09-23**, not recalled. Re-measure
before you commit to a budget — gas prices move.

## Measured inputs

ETH/USD (Coinbase spot): **$2,735.105**

`cast gas-price` (base fee + suggested tip), converted from wei to gwei:

| Chain | wei | gwei |
|---|---|---|
| Ethereum L1 | 300,258,030 | 0.3003 |
| Base | 6,000,000 | 0.0060 |
| OP Mainnet | 1,000,625 | 0.0010 |
| Arbitrum One | 20,004,000 | 0.0200 |
| Zora | 1,000,252 | 0.0010 |

OP-stack L1 data fee, from `GasPriceOracle.getL1Fee` at
`0x420000000000000000000000000000000000000F`, for a representative 260-byte
`post(string)` calldata payload (~180 chars of content):

| Chain | l1Fee (wei) | l1Fee (USD) |
|---|---|---|
| Base | 2,869,730,324 | $0.0000079 |
| OP Mainnet | 4,516,948,799 | $0.0000124 |
| Zora | 49,677,414,241 | $0.0001359 |

Note: mainnet L1 gas is currently **~0.3 gwei**, which is cheap by historical
standards. The case against L1 below is *not* "L1 gas is always expensive" — it
is built from today's actual reading.

## Gas-used assumptions (stated, not measured — no contract exists yet)

| Operation | Assumed gas | Justification |
|---|---|---|
| `post` | 75,000 | 21k intrinsic + ~4k calldata for 260 bytes + a `LOG` with ~180 bytes of data + one SSTORE for a post counter. Conservative. |
| `follow` | 50,000 | 21k intrinsic + one cold SSTORE to a new slot (20k) + overhead. |
| Deploy | 1,500,000 | Typical single-contract feed with registry + posting logic. |

Replace these with `cast estimate` against the real contract before finalizing.

## Per-action cost

`cost_usd = gas_used × gas_price_gwei × 1e-9 × eth_usd` (+ `l1_fee_eth × eth_usd` on OP-stack)

| Chain | post | follow | deploy |
|---|---|---|---|
| Ethereum L1 | $0.0616 | $0.0411 | $1.2319 |
| Base | $0.0012 | $0.0008 | $0.0246 |
| OP Mainnet | $0.00022 | $0.00015 | $0.0041 |
| Arbitrum One | $0.0041 | $0.0027 | $0.0821 |
| Zora | $0.00034 | $0.00027 | $0.0041 |

Deploy L1 data fee on OP-stack is negligible: I measured `getL1Fee` for an 8 KB
bytecode payload at 2.99e9 wei on Base ($0.0000082) and 4.46e9 wei on OP
($0.0000122) — barely above the 260-byte reading, so post-Dencun blob pricing
means data size is not the lever here. **Execution gas dominates on these
chains, not L1 data.** If you later optimize, optimize opcodes, not calldata —
but re-measure `gasUsed × effectiveGasPrice` vs `l1Fee` on real receipts first.

Arbitrum caveat: Arbitrum folds L1 data cost into *extra gas units* rather than
a separate `l1Fee`, so the 75k/50k assumptions understate it there. Its real
cost is somewhat above the table.

## The number that decides it

Agents post far more than humans. At a modest **100,000 posts + 20,000 follows
per month**:

| Chain | Monthly fee cost |
|---|---|
| Ethereum L1 | **$6,980.52** |
| Arbitrum One | $465.06 |
| Base | $140.43 |
| Zora | $39.56 |
| OP Mainnet | $24.75 |

## Reasoning

A social feed is the textbook high-frequency, low-value-per-action workload.
Each individual post is worth fractions of a cent, so a $0.062 L1 fee is ~100x
the economic value of the action it pays for. Mainnet stays the right answer for
low-frequency, high-value operations — treasury moves, governance, canonical
token issuance — and none of those describe a feed. If you ever want an L1
anchor, periodically commit a Merkle root of the feed to mainnet: at 0.3 gwei
that is ~$0.02 per checkpoint, and you get L1 settlement without paying L1 per
post.

Between the L2s, OP Mainnet and Zora are cheaper per action than Base, but the
absolute spread at this volume is ~$100/month — noise against engineering time.
Base wins on the things that actually matter for an agent social product:
the largest existing social graph on an Ethereum L2 (Farcaster's onchain
registry, plus the bulk of agent/bot deployments), the deepest bridged
liquidity if agents ever transact, and the best-supported tooling and indexers.
Zora's L1 fee is 17x Base's, which signals a less aggressively tuned fee
scalar and a thinner chain to depend on.

All options here settle to Ethereum, so the ecosystem commitment holds. Base is
an OP-stack rollup posting to L1; you inherit Ethereum security and stay inside
the Superchain, with a standard escape hatch back to L1.

## Before you ship

- Run `cast estimate` on the real contract and redo this table — the gas-used
  numbers above are assumptions.
- Derive `maxFeePerGas` from `cast base-fee` on Base immediately before each
  submission. Do not hardcode it and do not port a mainnet priority-fee
  constant — Base's tip is ~0.006 gwei, not the 1-2 gwei you'd use on L1.
- At agent volume, batch: one transaction carrying N posts amortizes the 21k
  intrinsic gas, which is the single largest component of the per-post cost.
