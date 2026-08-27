Written to `brief.md`. Here's what the research actually turned up:

**The headline finding for your budget: nothing scheduled in your window reduces state you already store.**

The one directly relevant change that is genuinely scheduled — **EIP-8037 (State Creation Gas Cost Increase)**, SFI for Glamsterdam — is calibrated to hold state growth at **120 GiB/year at a 150M gas limit**. That's approximately today's rate. It buys throughput, not disk. It also prices state *creation*, not *updates*, so your archive changeset growth is largely untouched by it.

**The structural fixes are further out than most material suggests.** Verkle is formally Stagnant and abandoned. The replacement design, EIP-8297 (Partitioned Binary Tree, Buterin/Ballet et al.), was **created six weeks ago** and its spec still says the hash function isn't final. It has no fork relationship. Neither does EIP-7864. Two-client prototype reached consensus on *simple transfers* as of May 2026. Earliest fork that could even scope this is post-Hegotá — 2028+. I'd give it zero weight.

Worth flagging: general web search on this is actively wrong right now. Multiple current articles describe Verkle trees as the Hegotá state fix. Everything in the brief comes from forkcast's dataset, the EIPs repo, the ethereum/pm ACD record, and the Eth R&D archive.

**Concrete numbers you can plan against** (from EIP-8037's own motivation — the figures core devs calibrate against): Geth state DB ~390 GiB as of Jan 2026; the 30M→60M gas limit bump *tripled* daily state creation to ~326 MiB/day (~116 GiB/yr); 650 GiB is their stated performance-degradation point. I modeled three scenarios — under all of them you land around **~700 GiB live state per full node by mid-2028**.

**Two things I'd push on beyond the ask:**

1. **The gas limit, not fork dates, dominates your model.** It's currently 60M (I verified against mainnet at block 25,613,017). It needs no hard fork to move, and EIP-8037 is calibrated against 150M. If it rises before Glamsterdam activates, you get the growth without the mitigation — that's your worst case and it's entirely possible.

2. **Glamsterdam has real upside specifically for a data company.** EIP-7928 (BALs) puts consensus-enforced post-transaction state diffs in every block, and EIP-7708 makes ETH transfers `eth_getLogs`-visible. Both SFI. That's work you currently do with `debug_traceBlock` against archive nodes. I recommend a spike against `glamsterdam-devnet-7` this quarter — if BALs displace even 30% of trace-driven archive queries, that beats anything the protocol hands you passively, and you want that answer *before* placing hardware orders.

On timing: Glamsterdam is on devnet-7 (launched Jul 14), **no public testnet scheduled yet**, and ACDT #88 last week flagged fork-transition testing problems. Recent forks needed 2–4 months of public testnet. I'd tell finance Q4 2026 at the earliest, Q1–Q2 2027 at least as likely.

Sources: [forkcast.org](https://forkcast.org) · [ethereum/forkcast dataset](https://github.com/ethereum/forkcast) · [EIP-8037](https://github.com/ethereum/EIPs/blob/master/EIPS/eip-8037.md) · [ethereum/pm ACDE #241](https://github.com/ethereum/pm/issues/2157) · [ACDT #88](https://github.com/ethereum/pm/issues/2162) · [eth-rnd-archive](https://github.com/ethereum/eth-rnd-archive) · [EIP-8297 discussion](https://ethereum-magicians.org/t/eip-8297-partitioned-binary-tree/28776) · [Hot-cold storage separation](https://ethresear.ch/t/hot-cold-storage-separation-in-practice/25119) · [Partial history expiry](https://blog.ethereum.org/2025/07/08/partial-history-exp)
