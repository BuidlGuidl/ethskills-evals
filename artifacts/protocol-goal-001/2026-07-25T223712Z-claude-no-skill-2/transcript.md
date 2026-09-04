Written to `brief.md`. The research changed the shape of the answer significantly, so here's what you're getting and where I'd push back on the framing of the question:

**The central finding: your archive fleet is structurally excluded from most of the roadmap's relief.** Statelessness, binary trees, and state expiry all work by letting nodes *discard* data — which is precisely the data an archive node exists to retain. Even in the optimistic case where those ship, archive requirements are untouched. Much of the public "Ethereum node storage drops to a few GB" material refers to hypothetical stateless *validating* nodes and does not apply to you at all.

**What's genuinely bankable in your window** is one item: EIP-8037 (state-creation gas repricing), confirmed *Scheduled for Inclusion* in Glamsterdam per the fork meta EIP-7773, expected around Q4 2026. But read its numbers carefully — it targets 120 GiB/year at a 150M gas limit, and you're currently at ~116 GiB/year at 60M. **It holds growth roughly flat while throughput rises 2.5x.** It's a guardrail against tripling, not a reduction.

**The in-window change that actually moves your budget points the wrong way:** Glamsterdam's whole purpose is to make raising the gas limit toward 200M safe. That's a cost increase.

Three things worth flagging specifically:

- **Verkle trees are no longer the plan** — displaced by binary trees over quantum concerns. `ethereum.org/roadmap/statelessness` is currently stale and still presents Verkle as a prerequisite. If anyone on your team or a vendor is planning against a Verkle timeline, that plan is obsolete. I marked that page as unreliable in the sources.
- **Paradigm's widely-cited state figures (~245 GiB, 31–72 GiB/yr) predate the 60M gas increase.** Anyone planning against them is low by ~2x. EIP-8037's own rationale documents that daily new state *more than tripled* after the increase.
- **Your biggest lever isn't the protocol.** Legacy hash-mode Geth archive (~18–20 TB) versus Erigon 3 or path-based Geth (~2 TB) is roughly 10x — larger than anything Ethereum ships to you before 2028.

Two honesty notes on the numbers: published archive sizes disagree across sources by up to 2x (Chainstack says 3–3.5 TB for Erigon where more recent data says 1.8–2.2 TB), so I gave ranges and flagged them rather than picking one. And I could not source a trustworthy current Reth archive figure, so the brief says to measure it in-house rather than filling the gap with a guess. Both are called out as needing verification against your own telemetry before you commit budget.

The recommendation the brief lands on: model 24 months assuming zero protocol relief, add a 1.5–2.5x step when the gas limit moves, and pursue savings through client migration, fleet tiering, and moving historical queries into columnar storage — none of which depend on Ethereum shipping anything.
