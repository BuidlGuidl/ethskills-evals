# State-proof format for a trust-minimized L1 light client

**Date of research: 2026-09-02.** Every status claim below was checked against the
live EIP records and hardfork meta-EIPs on the date above, not from memory. Re-check
before locking anything in; fork scope moves.

---

## Recommendation in one line

**Build the verifier around Merkle Patricia Trie (MPT) proofs as served by
`eth_getProof` (EIP-1186) — the format that is live on mainnet today — but put the
inclusion-proof logic behind a versioned, swappable backend interface, because the
protocol's genuine direction of travel is a *hash-only binary tree* (EIP-7864), and
that direction is real but completely unscheduled.**

Concretely: do not build on Verkle. Do not build on binary trees *yet*. Build on MPT
with a seam where the binary tree will eventually go.

---

## Where Ethereum's state layer actually stands today

**Live on mainnet.** The current fork is Fusaka (EIP-7607, status `Final`; mainnet
activation 2025-12-03 21:49:11 UTC, epoch 411392). Fusaka changed nothing about the
state layer. Mainnet state is still:

- A hexary Merkle Patricia Trie, keccak256-hashed, RLP-encoded.
- A separate account trie plus one storage trie per account, so proving a storage
  slot means two chained proofs (account proof to `stateRoot`, then storage proof to
  the account's `storageRoot`).
- Committed as `stateRoot` in the execution block header.
- Exposed over JSON-RPC as `eth_getProof`.

**This is the only state-proof format that works today, and no scheduled fork
changes it.**

---

## Where it is genuinely going

### Verkle trees are effectively abandoned — do not build on them

This is the single most important finding, because a lot of 2023–2024 roadmap
material and a fair amount of current secondary reporting still says otherwise.

- **EIP-6800** (Verkle state tree) — status **`Stagnant`**. Created 2023-03-17.
  Stagnant means it was left to rot without progressing.
- **EIP-4762** (state-access gas repricing for Verkle) — status **`Draft`**, created
  2022-02-03. Its own motivation says it "is targeting the fork coming right before
  the verkle tree fork." That fork never happened.
- Neither EIP appears **at any stage** — not Scheduled, not Considered, not even
  Proposed — in the Glamsterdam meta-EIP (EIP-7773) or the Hegotá meta-EIP
  (EIP-8081).

**No fork relationship whatsoever.** Verkle is precisely the design the question was
worried about: wiring a proof pipeline to something the protocol is moving away from.
The reason is architectural, not incidental — Verkle's IPA/Bandersnatch commitments
rest on elliptic curves, which are not post-quantum safe, and the protocol has pivoted
toward hash-only merkleization.

If you see a vendor, library, or article recommending Verkle-shaped witnesses
(~200-byte witnesses, Bandersnatch, IPA multiproofs), treat it as out of date.

### The binary tree (EIP-7864) is the real direction — but it is unscheduled

- **EIP-7864**, "Ethereum state using a unified binary tree" — status **`Draft`**,
  created 2025-01-20. Successor in spirit to EIP-3102 / EIP-6800.
- What it does: replaces the hexary MPT with a **binary** tree; **merges the account
  and storage tries into one tree** with uniform 32-byte keys; drops RLP; chunks
  contract code *into* the tree; co-locates related data so fewer branches open.
  Roughly ~75% smaller Merkle proofs and 3–4x fewer branch openings.
- Why it wins on merit: it depends only on hash functions, so it stays safe in a
  post-quantum setting, and it is far cheaper to prove inside a SNARK — which matters
  for the zkEVM / real-time-proving direction.

**But — and this is the part to be disciplined about — EIP-7864 has no fork
relationship at all:**

| Fork | Meta-EIP | Is EIP-7864 in it? |
|---|---|---|
| Glamsterdam | EIP-7773 (`Review`) | **No** — not in the 18 Scheduled-for-Inclusion EIPs |
| Hegotá | EIP-8081 (`Draft`) | **No** — not Scheduled, not Considered, and *not even in the ~50-entry Proposed-for-Inclusion list* |

Not-even-Proposed for the fork *after next* is a very weak position. Per EIP-7723,
Proposed → Considered → Scheduled → Included; EIP-7864 has not entered the pipeline
for either named fork.

**Even the hash function is undecided.** EIP-7864 states outright that "the hash
function used in the current draft is not final." The reference implementation uses
BLAKE3; the listed candidates are BLAKE3, Keccak, and Poseidon2. Poseidon2 is under
active cryptanalysis (the EF-funded Poseidon Cryptanalysis Initiative), that
cryptanalysis has produced real round-skipping attacks on reduced instances, and EF
sentiment has been shifting toward conventional SHA/BLAKE3. So the *leaf hash of the
future format is not settled*, let alone its activation fork.

Practical consequence: anyone shipping "binary tree proof verification" today is
guessing at the arity-independent parts and outright guessing at the hash. You cannot
write a correct binary-tree verifier yet.

### What *is* scheduled that touches state (Glamsterdam)

Glamsterdam (EIP-7773, meta status `Review`) has 18 core EIPs Scheduled for
Inclusion. None change the trie. The state-relevant ones:

- **EIP-7928 Block-Level Access Lists (SFI; EIP status `Review`)** — the one that
  matters to you. Adds a `block_access_list_hash` field to the **block header**,
  committing to every account and storage slot touched during block execution
  **together with post-execution values** (post-tx balances, nonces, code, storage
  writes and reads). Designed so clients can reconstruct state during sync "without
  individual proofs against the state root."
- **EIP-8037 / EIP-8038** — state-creation and state-access gas cost increases.
- **EIP-8189** — `snap/2`, BAL-based state healing (networking).
- **EIP-7688** — forward-compatible (SSZ) consensus data structures.

### Hegotá is early and speculative

EIP-8081 is `Draft` with only **two** Scheduled-for-Inclusion EIPs: EIP-7805 (FOCIL)
and EIP-8141 (Frame Transaction). Its `Considered for Inclusion` section is *empty*.
Everything else is in the weakest Proposed bucket. Ones worth *watching* but not
planning around: EIP-7862 (Delayed State Root), EIP-8025 (Optional Execution Proofs),
EIP-8304 (Trustless log and transaction index), EIP-8146 (Block Access List
Sidecars), EIP-8188 (Last-Written Block for Accounts and Slots), EIP-7807 (SSZ
execution blocks). Hegotá is being discussed for 2027.

---

## Timing — how hard a dependency you can safely take

Three separate timing risks, in decreasing severity:

1. **A new state trie has no date, and might never ship.** Verkle is Stagnant;
   the binary tree is Draft with zero fork relationship and an undecided hash
   function. **Take no hard dependency.** Your architecture must remain correct and
   shippable if EIP-7864 never activates. Do not put a migration date in a roadmap,
   and do not let a customer contract promise one.

2. **Even Glamsterdam is not locked.** The activation table in EIP-7773 is **empty** —
   no Sepolia, Holešky, or mainnet timestamp has been set. Devnets 0–7 ran roughly
   March–July 2026, the Plataberget public testnet forked in August 2026, and public
   testnet forks slipped into September, pushing the mainnet target to Q4 2026. It has
   already slipped once, and core devs have been explicit that correctness beats the
   date. So **BAL-based optimizations must be an optional fast path, not the primary
   path**, and must be feature-gated on actual activation rather than a calendar date.

3. **Any trie migration will be gradual, not atomic.** Both EIP-6800 and EIP-7864
   contemplate a transition period with an old tree and a new tree coexisting. Your
   verifier will need to support **two formats simultaneously** across the migration
   window — this is not a flag-day swap. Design for concurrent support from day one;
   it is much cheaper than retrofitting.

---

## What to actually build

**1. Verify the header trustlessly. This is the half that matters most and the half
no trie change can invalidate.**

The RPC-trust problem splits cleanly in two: (a) *is this block header canonical?*
and (b) *is this value in the state committed by that header?* Part (a) is where the
actual trust minimization lives, it is where most "light clients" cheat, and it is
**completely independent of the trie format**. Obtain `stateRoot` from a
consensus-verified header via a beacon-chain light client (sync-committee based —
the Helios model), never from the RPC response. Invest here first; this code survives
every scenario below.

**2. Use `eth_getProof` / MPT proofs as the inclusion-proof format today.**

It is the only thing that works on mainnet, it is universally served, and it will
remain valid for the entire life of the current trie plus the whole migration window.

**3. Put the inclusion proof behind a versioned backend interface.**

Give the verifier a narrow interface — `verify(state_root, address, slot) -> value` —
with a pluggable backend, and tag every serialized proof with an explicit
`proof_version` / fork identifier. Keep MPT specifics (hexary nibbles, RLP node
encodings, the two-stage account-then-storage chain) *inside* the backend. Do not let
them leak into your dApp-facing API, your wire format, or an on-chain verifier's
external signature. Both MPT and binary-tree verification reduce to "hash a path from
a leaf to a root," so the interface survives the swap even though the internals do
not.

**4. Do not pre-build for the binary tree beyond that seam.**

Specifically, do **not** now: hardcode a hash function; assume unified 32-byte keys or
a single merged account+storage tree; assume contract code lives in the tree; assume
proof sizes shrink; or implement anything Bandersnatch/IPA-shaped. Each is a
plausible guess about EIP-7864, and each would be wasted or wrong work today.

**5. Treat BALs as an opportunistic optimization, gated on Glamsterdam.**

Once EIP-7928 is live, `block_access_list_hash` in the header lets you authenticate a
slot's post-execution value for slots **touched in that block** without an MPT proof —
attractive for a frequently-written slot. Two caveats: it only covers *touched* slots,
so an untouched slot still needs a normal proof and you always need the MPT path as
fallback; and it is `Review`-stage in a fork with no locked date, so ship it behind a
runtime capability check, not a build-time assumption.

**6. Note the gas repricing if your verifier is on-chain.**

If proofs are verified in a contract (L1 or L2), EIP-8037 and EIP-8038 raise state
creation and state access costs in Glamsterdam. Proof verification itself is
hash/compute-heavy and largely unaffected, but any design that caches many roots or
results in storage gets more expensive. Re-run your gas model before Glamsterdam
activates.

---

## Summary table

| Approach | Status (2026-09-02) | Fork relationship | Verdict |
|---|---|---|---|
| MPT + `eth_getProof` (EIP-1186) | **Live on mainnet** since Fusaka and before | N/A — current | **Build on this now** |
| Verkle (EIP-6800 / EIP-4762) | **Stagnant** / Draft | **None** — absent from EIP-7773 and EIP-8081 | **Do not build on this** |
| Binary tree (EIP-7864) | **Draft**, hash function undecided | **None** — not even Proposed for Hegotá | **Direction of travel; leave a seam, take no dependency** |
| Block-Level Access Lists (EIP-7928) | `Review` | **SFI for Glamsterdam**, no activation date set | **Optional fast path, feature-gated** |

The short version: the honest answer to "what is Ethereum's state layer heading
toward" is *a hash-only binary tree* — but "heading toward" is doing heavy lifting.
It is not scheduled, its hash function is unchosen, and it is not in the queue for
either named upcoming fork. The correct engineering response is to ship on MPT, spend
your trust-minimization effort on consensus-verified headers where it cannot be
invalidated, and keep the merkle backend swappable so that if and when EIP-7864
lands you are replacing one module rather than your proof pipeline.

---

## Sources checked (2026-09-02)

- [EIP-7773: Hardfork Meta – Glamsterdam](https://eips.ethereum.org/EIPS/eip-7773) (and [raw source](https://raw.githubusercontent.com/ethereum/EIPs/master/EIPS/eip-7773.md))
- [EIP-8081: Hardfork Meta – Hegotá](https://eips.ethereum.org/EIPS/eip-8081) (and [raw source](https://raw.githubusercontent.com/ethereum/EIPs/master/EIPS/eip-8081.md))
- [EIP-7607: Hardfork Meta – Fusaka](https://eips.ethereum.org/EIPS/eip-7607) — `Final`, mainnet activation table
- [EIP-7723: Network Upgrade Inclusion Stages](https://eips.ethereum.org/EIPS/eip-7723) — definitions of SFI/CFI/DFI/PFI
- [EIP-7864: Ethereum state using a unified binary tree](https://eips.ethereum.org/EIPS/eip-7864) — `Draft`
- [EIP-6800: Ethereum state using a unified verkle tree](https://eips.ethereum.org/EIPS/eip-6800) — `Stagnant`
- [EIP-4762: Statelessness gas cost changes](https://eips.ethereum.org/EIPS/eip-4762) — `Draft`
- [EIP-7928: Block-Level Access Lists](https://eips.ethereum.org/EIPS/eip-7928) — `Review`
- [Forkcast](https://forkcast.org) — upgrade tracker (Glamsterdam, Hegotá)
- [Poseidon Cryptanalysis Initiative](https://www.poseidon-initiative.info/)
- [EF Blog, Checkpoint #9 (Apr 2026)](https://blog.ethereum.org/2026/04/10/checkpoint-9)
