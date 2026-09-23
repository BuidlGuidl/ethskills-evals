# Recommendation: state-proof format for a trust-minimized light client

**Build your verifier around standard Merkle-branch proofs against the block header `stateRoot` — concretely, hexary Merkle Patricia Trie (MPT) proofs as served today (e.g. `eth_getProof`) — with the tree/key-derivation layer isolated behind an interface so it can be swapped. Do NOT build around Verkle proofs. The direction Ethereum's state layer is genuinely heading is a *binary Merkle tree*, so a Merkle-proof-based architecture is the one that survives the eventual migration.**

Verified against live sources on 2026-09-23 (forkcast.org API, eips.ethereum.org, ethereum-magicians, ethresear.ch).

---

## Where the state layer stands today

- **Live on mainnet:** the state is committed in the **hexary Merkle Patricia Trie**. The post-Fusaka world (Fusaka activated 2025-12-03) still uses MPT for the execution-layer state root. The only state-proof format mainnet actually commits to and serves today is the MPT proof (account proof + storage proof against `stateRoot`, as returned by `eth_getProof`).
- **Glamsterdam** (next fork, SFI scope frozen, Sepolia testnet targeted 2026-10-06, mainnet projected ~Dec 2026 per forkcast's *estimate* — not an announced date) changes none of this. Its scheduled EIPs (ePBS, Block-Level Access Lists EIP-7928, state-gas repricing EIP-8037, etc.) leave the MPT state commitment untouched. Notably, BALs and EIP-7688's forward-compatible SSZ structures are *preparatory* work, not a new state tree.
- **Hegotá** (fork after Glamsterdam, projected ~2027, headliners already chosen: FOCIL and Frame Transactions) also does **not** include a state-tree change.

## Where it's genuinely going — and what it is *not*

**It is not Verkle.** EIP-6800 ("Ethereum state using a unified verkle tree") is marked **Stagnant** and, per forkcast, has **no fork relationship** — it is not Proposed, Considered, or Scheduled for Glamsterdam, Hegotá, or any tracked fork. The Verkle/IPA (polynomial-commitment) line of work has been superseded in current core-dev and research discussion. A verifier wired to Verkle witnesses would be a dead end — exactly the outcome you said you want to avoid.

**The actual destination is a binary Merkle tree:**

- **EIP-7864** ("unified binary tree", Jan 2025, Draft, no fork relationship) replaced Verkle as the favored direction.
- **EIP-8297** ("Partitioned Binary Tree", June 2026, Draft, no fork relationship) is the current, actively-developed successor — one unified binary tree with zones for account headers, content-addressed code, and storage. There is an open geth prototype PR and benchmarking work.
- **EIP-8347** ("Offline state migration to the PBT", July 2026, Draft, no fork relationship) defines the migration path: convert MPT state offline at an anchor block, catch up by replaying Glamsterdam's Block-Level Access Lists, and swap the state commitment at a single future fork. A full mainnet conversion has already been run experimentally (Erigon datadir → BLAKE3-hashed PBT).
- Current EF protocol research (ethresear.ch, "How Hegotá can influence the state roadmap", 2026-09-03) places the PBT migration in fork **"I\*"** — i.e. the fork *after* Hegotá — and explicitly frames Glamsterdam's BALs (EIP-7928) and state-gas work as laying the groundwork for it.

## Why this supports the recommendation

1. **Only MPT proofs work today.** Any format other than an MPT proof against `stateRoot` is unverifiable on mainnet right now, and will remain so through at least Glamsterdam and Hegotá. If you ship anything in the next ~12–18 months, it must verify MPT proofs.
2. **The destination is Merkle-shaped, not Verkle-shaped.** Both today's MPT and the future PBT are authenticated via *Merkle branches*: a path of sibling hashes from leaf to root, recomputed and compared against `stateRoot`. If your core verifier primitive is "verify a Merkle inclusion proof of key→value against a committed root," that primitive survives the migration. The parts that change are peripheral: key derivation (how address/slot map to a tree key), tree arity/encoding (hexary RLP nodes → binary, no RLP, zone prefixes), and possibly the hash function.
3. **A Verkle verifier would not survive.** Verkle proofs are IPA vector-commitment openings — a completely different cryptographic object. Committing to them now would require a full rewrite when PBT lands.

## Concrete design guidance

- Implement an MPT proof verifier (account + storage slot) against `stateRoot`, with the header itself sourced trust-minimized (e.g. via the consensus-layer light-client sync protocol / finalized beacon block roots, per your existing design).
- **Isolate three things behind interfaces**, because these are what the PBT fork changes:
  - *Key derivation*: MPT uses `keccak256(address)` / `keccak256(slot)`; PBT derives zone-prefixed, stem-grouped keys. Keep this a pure function you can replace.
  - *Node decoding & arity*: hexary RLP branch/extension/leaf nodes today; binary nodes (no RLP) later.
  - *Hash function*: Keccak today. PBT's hash is **explicitly not final** — the EIP-8297/7864 drafts use BLAKE3 as an implementation convenience and list Poseidon2 and Keccak as candidates. Do not hard-code Keccak assumptions deeper than one module.
- When the PBT fork eventually ships, your migration should be: new key-derivation + new branch-verification module, same "verify proof against header stateRoot" architecture, same upstream header sourcing.

## Timing flags — how hard a dependency you can take

- **MPT: safe hard dependency.** Live today, and explicitly retained (frozen but readable) through any future migration window; EIP-8347's plan even maintains both trees through a transition period. There is no scenario in the current roadmap where MPT proofs stop being verifiable against recent mainnet history before you have years of warning.
- **PBT: do NOT take a hard dependency.** EIP-8297 and EIP-8347 are both **Draft** status with **no fork relationship** — not even CFI for Hegotá. Research consensus points at the post-Hegotá "I\*" fork, which with Hegotá itself projected for ~2027 means the state-tree swap is realistically **2027–2028 at the earliest**, and could slip further or change shape (the hash function and parts of the tree layout are still unsettled; the spec is ~3 months old). Draft status reflects spec maturity only and implies nothing about scheduling.
- **Trigger to re-evaluate:** check forkcast periodically. The signal that justifies investing in a PBT verifier is **EIP-8297 moving to CFI (Considered) and then SFI (Scheduled) for a named fork**. Until then, treat it as a monitor-only item and keep the abstraction seams above clean. Also watch Glamsterdam's BAL rollout (EIP-7928), since complete and reliable BALs are a stated dependency of the offline migration — BAL delivery problems would push the migration further out.

## Sources checked (2026-09-23)

- forkcast.org `/api/eips/6800.json` — Verkle: Stagnant, **no fork relationship**
- forkcast.org `/api/eips/7864.json`, `/api/eips/8297.json`, `/api/eips/8347.json` — binary-tree line: all Draft, **no fork relationship**
- forkcast.org `/api/upgrades.json` — Fusaka Live (2025-12-03); Glamsterdam Upcoming (projected 2026-12-02, forkcast estimate); Hegotá Planning (projected 2027-06-16, headliners: FOCIL + Frame Txs)
- EIP-7773 (Glamsterdam meta) — SFI list contains no state-tree change; includes EIP-7928 (BALs), EIP-8037 (state gas)
- EIP-8297 / EIP-8347 specs and "How Hegotá can influence the state roadmap" (ethresear.ch, 2026-09-03) — PBT as the state roadmap; migration expected in fork "I\*"; hash function TBD
