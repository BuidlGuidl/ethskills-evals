Written to `brief.md`. The headline findings, with what I verified:

**The thing most likely to be mis-sold to you:** binary state trees (EIP-7864) are `Draft`, not in Glamsterdam, and **not even in the "Proposed for Inclusion" list for Hegotá** — the fork after that. Cross-client work is at the experimental-branch stage (Besu/Geth agreeing on simple transfers as of May 2026), and the hash function isn't chosen. Verkle (EIP-6800) is `Stagnant` — abandoned over ZK and post-quantum concerns, which is exactly why roadmap material shouldn't be read as a schedule. State expiry is dormant too (EIP-7736 `Stagnant`; its R&D channel had one message in two years). Nothing here lands in your window.

**What is real:** EIP-8037 (State Creation Gas Cost Increase) is SFI for Glamsterdam and already implemented in Geth v1.17.4. But read its design goal carefully — it targets ~120 GiB/year of state growth *at a 150M gas limit*. It's a rate cap that makes higher throughput not cost extra disk. Your growth stays roughly flat; you never get bytes back.

**Three things I'd flag as the analytical core of the brief:**

1. **Your archive problem is not the problem the protocol is solving.** Current state (~390 GiB), history, and *historical* state are three different things. EIP-8037 prices state *creation*; archive growth tracks state *mutation* — overwrites that add nothing to current state but generate diffs you keep forever. The EIP that would actually help you is 8038 (`STORAGE_WRITE` +257%), and it's only CFI. If the gas limit rises post-Glamsterdam, archive growth likely *accelerates* even as current-state growth stays flat.

2. **History expiry gives archive nodes nothing.** It shipped (via eth/69, not EIP-4444, which is `Stagnant`) and took 300-500 GB off full nodes. Any plan crediting it against archive disk is double-counting.

3. **Timing:** `all-forks.json` shows Glamsterdam with `activation.timestamp: null`, and it's configured on **no public testnet** — Sepolia and Hoodi both top out at Fulu. Q4 2026–Q1 2027 realistic. Your highest-probability adverse surprise is a validator-voted gas limit increase, which needs no fork at all.

The biggest lever in your window is client/storage-engine choice, not protocol: path-based Geth archive and Erigon 3 are ~2 TB vs ~15-20 TB legacy hash-based. Also worth a look is Geth's `--history.trienode`, which lets you set the historical-proof window independently of state history — good for tiering the fleet, since most consumers don't need historical `eth_getProof`.

One gap I'd rather name than paper over: I couldn't find a reliable published time series for *archive* growth rate — it varies too much by client and workload. So §4.3 is qualitative where §4.2 is quantitative, and the first recommendation is to instrument it yourselves (`--state.size-tracking` / `debug_stateSize`, correlated against daily gas consumed). That coefficient is the number that would most improve your next budget cycle.
