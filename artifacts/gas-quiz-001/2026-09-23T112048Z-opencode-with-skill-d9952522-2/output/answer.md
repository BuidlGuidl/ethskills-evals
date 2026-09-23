# Escrow for freelance payments ($2,000–$50,000 per job): chain recommendation

**Recommendation: deploy on Ethereum mainnet.** The measured transaction cost of a full escrow
lifecycle is under $0.20 on mainnet today, so cost is not a reason to move elsewhere, and for a
contract that *holds* five figures of other people's money for days or weeks, mainnet's security
and settlement guarantees dominate the decision. An L2 (e.g. Base) is a reasonable alternative
only if you expect very high job volume or many small per-job interactions.

## Numbers used (measured today, 2026-09-23)

| Quantity | Value | Source |
|---|---|---|
| ETH/USD | $2,728.37 | Coinbase spot API |
| Mainnet gas price | 0.3317 gwei (331,683,323 wei) | `cast gas-price` via ethereum-rpc.publicnode.com |
| Base gas price | 0.0060 gwei (6,000,000 wei) | `cast gas-price` via mainnet.base.org |
| Base L1 data fee | 6.88e-9 ETH per tx (measured `l1Fee` on a recent receipt) | `cast receipt` on Base |

**Gas-used assumption:** ~200,000 gas per job lifecycle, broken down as ~120,000 for the deposit
(ERC-20 transfer into the contract plus cold-storage escrow bookkeeping) and ~70,000 for the
release/refund. A simple ETH-only escrow would be cheaper; 200k is a conservative figure for a
stablecoin escrow.

## Cost per job

**Mainnet** (execution only):
200,000 gas × 0.3317 gwei × 1e-9 × $2,728.37 = **~$0.18 per job**

**Base** (execution + L1 data fee, which is a separate component not included in the gas price):
- Execution: 200,000 × 0.006 gwei × 1e-9 × $2,728.37 = ~$0.0033
- L1 data fee: 6.88e-9 ETH × 2 txs × $2,728.37 = ~$0.00004
- Total: **~$0.003 per job**

## Reasoning

1. **Cost is a rounding error at these job values.** $0.18 on mainnet vs $0.003 on Base is
   0.009% vs 0.0002% of even the smallest ($2,000) job. Nobody picks a custody chain to save
   18 cents against a $2,000–$50,000 escrow.
2. **Escrow is low-frequency, high-value activity** — a handful of transactions per job spread
   over days or weeks. That is exactly the profile where mainnet remains the right default; L2s
   earn their keep on high-frequency, low-value, or latency-sensitive workloads.
3. **What actually matters for escrow is asset safety, not fees.** Holding up to $50k introduces
   bridge risk, sequencer liveness/upgrade-key risk, and more complex dispute-resolution
   failure modes on an L2. Mainnet minimizes all of these and has the deepest stablecoin
   liquidity for payouts.
4. **When to reconsider an L2:** if the product evolves toward thousands of jobs/day, frequent
   on-chain status updates or milestone releases, or a sub-$500 job tier where even ~$1 of
   gas-spike exposure matters. Note the tail risk on mainnet: at 50 gwei the same lifecycle
   costs ~$27 (1.4% of a $2,000 job), so set `maxFeePerGas` from the live base fee at
   submission time and consider batching or an L2 if that exposure becomes material.

## Bottom line

Deploy on **Ethereum mainnet**. Fees are negligible at the measured 0.33 gwei (~$0.18/job), and
for a custody contract holding $2k–$50k the security and settlement assurances of mainnet
outweigh Base's ~$0.18/job savings. Revisit an L2 only if volume or interaction frequency
changes the workload profile.
