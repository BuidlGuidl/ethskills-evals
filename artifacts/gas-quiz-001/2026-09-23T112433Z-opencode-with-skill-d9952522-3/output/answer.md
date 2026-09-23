# Chain choice for a freelance-payment escrow: **Ethereum mainnet**

Measured live on **2026-09-23**. Short version: a full job's on-chain lifecycle costs **$0.27 on mainnet** vs **$0.005 on Base**. Both are noise next to a $2,000–$50,000 job, so cost does not decide — and when cost stops deciding, a contract holding up to $50k per job (and growing TVL) should sit on the chain with the deepest security and fewest trust assumptions: mainnet.

## Live measurements (2026-09-23)

| Reading | Raw | Usable | Source |
|---|---|---|---|
| Mainnet gas price | 330,591,509 wei | 0.331 gwei | `cast gas-price` @ `ethereum-rpc.publicnode.com` |
| Mainnet base fee | 305,268,962 wei | 0.305 gwei | `cast base-fee` (cross-check: `eth.drpc.org` gas-price 0.306 gwei) |
| Base gas price | 6,000,000 wei | 0.006 gwei | `cast gas-price` @ `mainnet.base.org` |
| Base L1 data fee (36-byte `release(uint256)` calldata) | 3,321,422,916 wei | 0.0000000033 ETH | `GasPriceOracle.getL1Fee` @ `0x420000000000000000000000000000000000000F` |
| ETH/USD | 273,038,387,913 (8 dp) | $2,730.38 | Chainlink `0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419` `latestRoundData()`; Coinbase spot cross-check $2,723.71 |

Note: on an OP-stack L2 the execution gas price is **not** the whole cost — the L1 data fee is a separate component, so it was measured via the oracle preinstall rather than estimated. All `cast gas-price`/`base-fee` readings print wei; they were divided by 1e9 and checked back against the raw values above.

## Workload model

- **Actions per job:** deposit + 2 milestone releases + final release/refund ≈ **4 transactions**, spread over days-to-weeks. Low frequency, no latency sensitivity.
- **Gas per action:** ~**75,000** (ERC-20 payout transfer 50–65k + storage updates, access checks, event). Conservative bound: 100k.
- **Value per job:** $2,000–$50,000 held. TVL scales with concurrency: 200 active jobs × ~$10k avg ≈ **$2M in custody**.
- **Deployment:** ~2.5M gas, one-time; per-job state kept in a mapping (no per-job contract deploys).

## The math

Mainnet — `cost = gas_used × gas_price × ETH/USD`:

| Operation | Gas | Cost |
|---|---|---|
| One escrow action | 75,000 | 75,000 × 0.331 gwei = 0.0000248 ETH = **$0.068** |
| Full job lifecycle (4 actions) | 300,000 | **$0.27** = 0.014% of a $2,000 job, 0.0005% of a $50k job |
| Conservative bound | 400,000 | $0.36 = 0.018% of the smallest job |
| One-time deploy | 2,500,000 | $2.26 |

Base — `cost = (gas_used × gas_price + l1_fee) × ETH/USD`:

| Operation | Gas | Execution | L1 data fee | Total |
|---|---|---|---|---|
| One escrow action | 75,000 | 4.5e-7 ETH = $0.0012 | 3.3e-9 ETH ≈ $0.00001 | **$0.0012** |
| Full job lifecycle | 300,000 | $0.0049 | ≈ $0.00004 | **$0.005** |
| One-time deploy | 2,500,000 | $0.041 | scales with bytecode size (few cents) | **≈ $0.05–0.10** |

Mainnet is ~54× more expensive than Base per job — an absolute difference of **26 cents**.

## Why mainnet

1. **Cost stopped being a differentiator.** 27¢ vs 0.5¢ per job lifecycle, against jobs worth $2,000 minimum. The remembered prior "mainnet gas is expensive" is simply false today: 0.33 gwei at $2,730/ETH.
2. **The workload profile is exactly mainnet-shaped.** Low-frequency (a handful of transactions per job over weeks), high-value custody, not latency-sensitive — the profile where mainnet remains the default. Nothing in a freelance escrow needs an L2.
3. **Custody risk scales with TVL, not with per-tx fees.** The contract holds clients' money for weeks. Mainnet has no sequencer liveness risk, no security-council upgrade keys, and the deepest validator set / settlement layer. At ~200 concurrent jobs the contract holds ~$2M; a ~26¢/job premium for that security is a bargain.
4. **Fees can dodge spikes.** Deposits and releases are never urgent, so they can be sent in cheap windows. Even a 10× gas spike (3.3 gwei) makes the lifecycle $2.71 — 0.14% of the smallest job. A pathological 2021-style 300-gwei day would be ~$246 per job, but nothing stops users from waiting those out.
5. **Settlement depth.** USDC/ETH liquidity and price oracles are deepest on mainnet.

## When to add Base

Measured Base costs ($0.0012/action) leave enormous headroom if the product later needs:

- high-frequency, low-value writes (streaming milestone payments, per-message attestations, reputation updates), or
- gasless UX for freelancers who hold no ETH.

Run those on Base (or batch them) while keeping core custody on mainnet. That's a cost decision to re-measure then — not a reason to avoid mainnet now.

## Implementation notes

- Derive EIP-1559 fee fields from live readings at submission time — today's mainnet base fee is 0.305 gwei. Don't hardcode, and never port a mainnet priority-fee constant to an L2.
- Consider sponsoring the freelancer's claim/release transactions (a few cents each at current prices) instead of moving chains.
- Keep per-job accounting in a singleton mapping; per-job clone deploys (~350k gas ≈ $0.32 today) would not change the conclusion but add nothing here.

---
*All inputs fetched live 2026-09-23 via `cast` (publicnode, drpc, mainnet.base.org) and the Chainlink ETH/USD feed; the Base L1 data fee was measured through the `GasPriceOracle` preinstall for a representative 36-byte `release(uint256)` call, not estimated.*
