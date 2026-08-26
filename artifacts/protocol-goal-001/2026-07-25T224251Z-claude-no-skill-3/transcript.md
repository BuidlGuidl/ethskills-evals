Written to `brief.md`. The headline findings, since they're not what the roadmap marketing implies:

**Nothing in your planning window reduces archive disk.** Statelessness, state expiry (EIP-7736 is *Stagnant*), and binary trees (EIP-7864, Draft, no fork target, hash function still undecided) are all unscheduled. The EF's own Feb 2026 priorities post files them under "long term."

**Verkle is cancelled.** A lot of currently-circulating content — including `ethereum.org/roadmap/statelessness` itself, which still cites Feb 2023 figures — claims Hegotá ships Verkle trees for a ~90% storage cut. Hegotá's actual headliner is FOCIL. I flagged this explicitly in §2.2 because it's the most likely thing to contaminate a budget discussion.

**The repricing that *is* coming makes your numbers worse, not better.** EIP-8037 (SFI for Glamsterdam, spec finalized at the May interop) derives its 1,530 gas/byte by solving backwards from a target of 120 GiB/yr *at a 150M gas limit*. That target scales with the gas limit — at the stated 200M post-Glamsterdam floor it implies ~160 GiB/yr, versus ~116 GiB/yr measured today at 60M. It's a brake on a vehicle that's accelerating: it exists to make the gas limit increase safe, which is a different goal from making your life easier.

**The real driver is throughput, not state bloat.** Four of the five terms in archive growth (change diffs, receipts, block bodies, your indices) scale with gas used, not net new state — and repricing constrains only the fifth. The 30M→60M raise already tripled daily new state, 105→326 MiB/day. Plan for 1.7–2.0x current growth, with contractual headroom to 3.3x.

Two things I'd flag for your attention specifically:

- **I deliberately did not invent an archive-delta figure.** Published archive sizes are point-in-time totals that conflate ten years of accumulation and vary by client and index config. §4.2 gives you the measurement procedure to derive your own constant `k`; the scenario table is multipliers on it. That number is worth more than anything else in the document.
- **Your biggest lever is client choice, not the protocol.** Hash-based Geth is >20 TB vs ~1.8–2.2 TB for Erigon 3 / Reth / Geth path-based — a ~10x that dwarfs the entire roadmap. Worth confirming before any hardware purchase. There's one product decision embedded there: historical `eth_getProof` requires Geth's `--history.trienode` at up to ~6.5 TB, so if customers need it, you want a few proof-capable nodes rather than a proof-capable fleet.

One genuinely favorable item: history expiry means peers are dropping the history you sell, so backfilling the era1 set now (§5.5) converts a roadmap risk into a scarce asset — but that window closes as distribution thins out.
