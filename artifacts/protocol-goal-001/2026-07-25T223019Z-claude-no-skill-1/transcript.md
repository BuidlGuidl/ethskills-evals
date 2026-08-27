Written to `brief.md`. The core findings, since they reframe the problem somewhat:

**The framing that matters most for your fleet:** "state growth" is three datasets, and archive nodes are hit by the one the roadmap barely touches. Live state (~245 GiB raw, ~82% contract storage, growing ~2.6 GiB/month) is what state expiry and repricing target. Chain history is what EIP-4444 already fixed. But **historical state — the per-block changesets that make an archive node an archive node — grows with write *throughput*, not with live state size**, and it has no pruning mechanism, in the protocol or in principle.

**Three things you can genuinely bank on:**
- EIP-4444 partial history expiry shipped July 2025 across all EL clients: 300–500 GB/node, free, possibly not enabled everywhere in your fleet. Worth auditing this week.
- Glamsterdam, realistic mainnet Sept–Dec 2026 (scheduled 2026-09-16; ePBS is the slip risk, and it's already slipped from H1). Contains EIP-8037 state-creation repricing — new account 25,000 → 183,600 gas.
- Modern archive clients: Erigon 3.x ~1.8–2.2 TB vs 12+ TB for legacy hash-based Geth.

**The uncomfortable part for capacity planning:** EIP-8037 was engineered specifically so a **200M gas limit** stays under ~120 GiB/year of live-state growth. Today's actual rate is 31–72 GiB/yr. The roadmap's own success criterion is state growing *faster* in absolute terms, in exchange for ~3× throughput. And even a successful state-expiry rollout wouldn't shrink your fleet — expiry lets full nodes forget things; archive nodes forget nothing by definition. Verkle is effectively dead (dropped mid-2025, partly post-quantum concerns); its replacement EIP-7864 has been in Draft since January 2025 with no fork assignment.

So the brief's recommendation is to plan for **~2× current archive footprint by mid-2028** (base case 4.0–4.6 TB/node, high case up to ~6.2 TB) and treat any protocol relief as pure upside. The highest-leverage moves are all internal: workload tiering so hot queries stop hitting archive hardware, and range-sharding the archive tier — which is the same shape as the EF's "archive cluster" idea, buildable now.

Two caveats I'd flag before this goes to finance: the per-year archive growth figures are **derived** from published point-in-time footprints rather than measured, so §4.6 recommends instrumenting your own bytes-per-gas within a quarter to replace them. And EIP-8037's constants are still Draft and were being tuned on devnets as recently as May 2026.

One item worth checking against your product surface: Geth's path-based archive doesn't serve historical `eth_getProof`. If you sell proofs, that constrains client consolidation to Erigon/Reth.
