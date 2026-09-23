# Recommendation: build your verifier around MPT (Keccak/RLP) state proofs, behind a witness-format abstraction. Do not build on Verkle, and do not hard-depend on the binary-tree proposals.

**TL;DR:** The Merkle Patricia Trie is the only state-proof format that is live on mainnet today *and* committed to remain the state commitment through the entire scheduled fork horizon (Glamsterdam, projected mainnet Dec 2026 — a forkcast estimate — and nothing state-tree-shaped in Hegotá planning either). Verkle is formally Stagnant — it is the design the protocol has moved *away* from. Ethereum's genuine forward direction is a hash-based **binary state tree plus STARK/zkVM validity proofs**, but that direction is Draft-stage research with **no fork relationship** and even an undecided hash function — so take it as a watch item behind an abstraction, never a hard dependency.

All status claims below were checked against forkcast.org and its EIP/fork datasets on 2026-09-23.

---

## 1. Where Ethereum's state layer stands today (live on mainnet)

- **The state commitment every mainnet block header carries is the MPT `stateRoot`** — a Keccak/RLP "tree of trees" (global account trie + per-contract storage tries). This is live, and it is the *only* state commitment the protocol produces.
- **The witness format that matches it is the MPT Merkle proof**, served de facto by `eth_getProof` (EIP-1186: account proof → account's `storageRoot` → storage proof for your slot). The EIP-1186 document itself is marked **Stagnant** (interface specs have moved to the execution-apis repo), but the JSON-RPC method is implemented by every major EL client and is the working standard. Treat execution-apis as the normative reference, not the old EIP.
- **The trust-minimization property is exactly what you need:** the RPC provider only *supplies* the witness; your verifier checks the Keccak/RLP branch hashes against the `stateRoot` of a block header you obtained yourself. A wrong or malicious witness fails verification; a correct one requires no trust in the provider. Anchor the header with a beacon-chain light client (sync committees, live since Altair) rather than trusting the provider's `latest`.
- For *recent* blocks, one self-run full node's retained state (plus your light client for headers) suffices to generate/validate witnesses; archive data is only needed for deep-historical slots. Multiple RPC providers can also be cross-checked for liveness while remaining trust-minimized for correctness.

This is the only option that is simultaneously (a) verifiable against real mainnet headers today, (b) safe for the whole committed fork horizon, and (c) end-to-end trust-minimized.

## 2. Where the state layer is genuinely going (as of Sep 2026)

**Verkle is off the table.** EIP-6800 (unified Verkle tree), EIP-7545 (Verkle proof precompile), EIP-7612 (overlay transition), and EIP-7736 are all spec-status **Stagnant** with **no fork relationship** to any tracked upgrade. The 2024–2025 pivot — driven by the maturation of SNARK/STARK proving systems — is fully reflected in the current EIP statuses. If you wire your pipeline to Verkle proofs, you are committing to the design Ethereum deliberately walked away from.

**The actual destination is a hash-based binary tree + validity proofs.** EIP-7864 ("Ethereum state using a unified binary tree", Jan 2025) and its newer refinement EIP-8297 ("Partitioned Binary Tree", Jun 2026) replace the MPT with a binary, RLP-free tree, motivated explicitly by (i) block validity proofs and (ii) *small fast regular Merkle proofs* — the exact thing your dApp state-proof verifier needs. But:

- Both are **Draft** with **no fork relationship** — not Proposed, not Considered, not Scheduled for *any* named fork (not Glamsterdam, not Hegotá). Per the fork-stage taxonomy, that is research/proposal-only; no ship date exists and none should be assumed.
- The **hash function is not even decided** — the spec uses BLAKE3 provisionally, lists Keccak and Poseidon2 as candidates, and says in bold text "Do not assume BLAKE3 is a final decision."
- The design is still churning: 7864 → 8297 substantially restructured the tree (zoned/partitioned keys) within 17 months. Any dependency taken now would be on quicksand.

**The near-term protocol work is witness/proving infrastructure, not a tree swap.** This is the part people miss when they assume "statelessness = new tree soon":

- **Glamsterdam (Scheduled; Sepolia activates Oct 6 2026; mainnet projected ~Dec 2026 — a planning estimate, not an announced date):** headliner EIP-7928 **Block-Level Access Lists**, plus BAL networking (eth/71 BAL exchange, snap/2 BAL-based state healing). The meta-EIP 7773 scope contains **zero state-tree changes**. BALs are relevant to you long-term: the Draft extension EIP-8268 would expose post-block per-account storage trie roots, giving verifiers cheap per-account commitments at block boundaries.
- **Hegotá (planning, projected 2027 — again an estimate; headliners are FOCIL and Frame Tx):** the items closest to your problem are all still only *Proposed*: **EIP-8025 Optional Execution Proofs** (opt-in zkVM validity proofs of execution, no consensus-rule change — the "L1 zkEVM" direction), EIP-7709 (BLOCKHASH via EIP-2935 storage, simplifying witness construction), and EIP-8304 (trustless log/tx index — the same problem class as yours, but for events). The L1-zkEVM working group has been running all through 2026 standardizing an SSZ **execution-witness** format (with engine/RPC surface for witness retrieval) and benchmarking zkVM provers on mainnet blocks — a recent 72-hour run proved 99.4% of mainnet blocks within 12 seconds on 16 GPUs. That is where "state proofs" are trending: raw witnesses increasingly wrapped in zkVM/STARK validity proofs, decoupled from any specific tree.

So the two-statement version of the roadmap: (1) commitment format: MPT today → binary hash tree eventually (unscheduled, years out, requires a state-conversion migration that doesn't yet exist as a fork-tracked EIP); (2) proof consumption: raw Merkle branches today → increasingly zk-proved witnesses (infrastructure being standardized now, protocol inclusion not yet committed).

## 3. Timing: how hard a dependency can you safely take?

| Dependency | Verdict | Why |
|---|---|---|
| **MPT proof verification (Keccak/RLP, header stateRoot)** | **Safe as a hard dependency** | No scheduled or even Proposed fork changes the state tree. The successor direction has no fork relationship and needs a full-state-conversion EIP plus multi-year migration before mainnet's *current* root means anything else. Even after a future swap, MPT proofs remain valid for all pre-migration history, so this code never becomes dead. |
| **Verkle (EIP-6800 family)** | **Do not build on it** | Stagnant, no fork relationship, abandoned by the protocol. This is precisely the "design the protocol is moving away from" you asked to avoid. |
| **Binary tree (EIP-7864/EIP-8297)** | **Watch behind an abstraction; no hard dependency** | Draft, no fork relationship, hash function undecided, active design churn. Fine to read and prototype against; unsafe to commit your pipeline to. |
| **zkVM/execution proofs (EIP-8025, SSZ execution witness)** | **Watch** | Real momentum (dedicated working group, standardized SSZ witness, strong benchmark results), but EIP-8025 is only *Proposed* for Hegotá and is opt-in/non-consensus. Irrelevant to a hard dependency decision today. |

One watch item on the *header-anchoring* side of your pipeline: EIP-8390 (remove the sync committee in favor of offchain ZK proofs) is a Draft from Aug 2026 with no fork relationship. Your beacon light client is safe today; just be aware that part of the stack has its own (unscheduled) change proposals.

## 4. Concrete plan

1. **Build the MPT verifier now**: `verifyStorageSlot(header, address, slot, witness) -> value`, walking account trie → `storageRoot` → storage trie, all Keccak/RLP. Source witnesses via `eth_getProof` (normative spec: execution-apis), anchored to headers from your own CL light client. This serves your dApp today with zero protocol trust assumptions beyond Ethereum's consensus.
2. **Isolate the witness wire-format in one module** behind a small interface (`WitnessParser`/`ProofVerifier`). The MPT path is the first backend; this makes adding a binary-tree or zk-wrapped-witness backend a bounded change later instead of a rewrite.
3. **Set explicit triggers** for revisiting the format decision (any of these on forkcast/EIP stage changes): a binary-tree EIP reaching *Considered* or better for a named fork; the hash function being finalized in EIP-8297; a state-conversion EIP appearing; EIP-8025 moving past Proposed (at that point zk-proved state reads may become a cheaper alternative to raw witnesses); EIP-8304 landing if you also need verifiable event lookups.
4. **Don't over-engineer for size**: MPT proofs for a single storage slot at a recent block are a few KB and cheap to verify off-chain; the MPT's proof-size problems matter for whole-block statelessness, not for your one-slot use case. This is another reason the "MPT is legacy, wait for the future" instinct is wrong for your product.

## Sources checked (forkcast.org, 2026-09-23)

- Upgrade dataset: Pectra (live May 2025), Fusaka (live Dec 2025), Glamsterdam (Scheduled; Sepolia epoch 353024 on 2026-10-06; mainnet `projectedActivation` 2026-12-02 — forkcast's estimate, not an announced date), Hegotá (Planning; projected 2027; headliners FOCIL + Frame Tx).
- Glamsterdam scope: meta-EIP 7773 (Scheduled list — no state-tree EIPs; EIP-7928 BALs included).
- EIP records: 6800/7545/7612/7736 (Verkle — Stagnant, no fork relationship), 7748 (Verkle conversion — Draft, no fork), 7864 & 8297 (binary trees — Draft, no fork), 1186 (eth_getProof — Stagnant, no fork), 7928 (BALs — Scheduled for Glamsterdam), 8025 (Optional Execution Proofs — Proposed for Hegotá), 7709 & 8304 (Proposed for Hegotá), 8268 (BAL storage roots — Draft), 8390 (remove sync committee — Draft, no fork).
- Call corpus: L1-zkEVM breakouts #01–#08 (Feb–Sep 2026; execution-witness/SSZ standardization, zkVM mainnet proving results), ACDE #242/#244, RPC Standards #30/#31/#34.
