# Anonymous DAO voting — notes

Goal: yes/no proposals, one ballot per member per proposal, public tally after
the deadline, and **no one (including the DAO operators) can tell how any
individual member voted.**

Design in one paragraph: each member **registers once** from their public NFT
wallet. Registering adds a hiding *identity commitment* to an onchain Poseidon
Merkle tree (LeanIMT). For each proposal, a member **votes from a wallet that
has no link to them**, normally a relayer's. The ballot carries a Noir
zero-knowledge proof that says "the sender knows the secret behind *some*
commitment in this proposal's snapshot of the tree, the vote is 0/1, and here
is this member's nullifier for this proposal". The contract rejects a repeated
nullifier, which blocks double votes. Nullifiers differ per proposal, so two
ballots from the same member can't be linked to each other.

## Layout

| Path | What |
|---|---|
| `circuits/vote/src/main.nr` | Ballot circuit (Noir 1.0.0-rc.2, `poseidon` v0.3.0) plus `nargo test` cases |
| `contracts/src/AnonymousVoting.sol` | Registry, proposals, nullifiers, tally |
| `contracts/src/verifiers/HonkVerifier.sol` | **Generated** by `bb write_solidity_verifier -t evm` (ZK UltraHonk). Deployed separately. |
| `contracts/src/interfaces/IBallotVerifier.sol` | Mirrors the generated verifier's `verify(bytes, bytes32[])` ABI |
| `contracts/src/MembershipNFT.sol` | Local stand-in for your existing membership NFT (soulbound) |
| `contracts/script/Deploy.s.sol` | Deploys verifier → (NFT) → AnonymousVoting (links PoseidonT3 + LeanIMT) and writes `deployments/<chainId>.json` |
| `contracts/test/AnonymousVoting.t.sol` | Integration tests using the **real** verifier and real proofs (via ffi → NoirJS) |
| `scripts/build-circuit.sh` | `nargo test` + `nargo compile` + VK + regenerate verifier |
| `scripts/deploy-local.sh` | Runs the forge deploy script against `RPC_URL` |
| `scripts/member-register.mjs` | Member: create the secret note, then `register` from the NFT wallet |
| `scripts/member-vote.mjs` | **Member: secret → proof → vote transaction** (via relayer or unlinked wallet) |
| `scripts/relayer.mjs` | Minimal HTTP relayer that pays gas for `castVote` |
| `scripts/tally.mjs` | Anyone: read the result after the deadline |
| `scripts/demo-local.sh` | Full flow on a throwaway anvil chain |

## Running it

```bash
npm install
bash scripts/build-circuit.sh          # needs nargo 1.0.0-rc.2 + bb 5.2.0 (bb.js pinned to 5.2.0 to match)
(cd contracts && forge build && forge test)   # 9 tests; proofs generated through ffi
bash scripts/demo-local.sh             # own anvil on :18555, relayer on :18788
```

Demo output tail:
```
== member 2 tries to vote again (must fail)
Error: relayer rejected ballot: AlreadyVoted
== member 1 tries to send its ballot from its own NFT wallet (script refuses)
Error: refusing to send the ballot from your member wallet — that would sign your vote with your name
proposal 1: yes=3 no=1 turnout=4/5
```

Against a chain you run yourself: `anvil`, then `RPC_URL=… MIN_ANONYMITY_SET=… bash scripts/deploy-local.sh`
(add `MEMBERSHIP_NFT=0x…` to use your real NFT), then the member scripts. Each
script's header lists its environment variables.

## The circuit

```
private: identity_nullifier, identity_trapdoor, merkle_depth, merkle_indices[16], merkle_siblings[16]
public : merkle_root, scope, vote, nullifier_hash          (this order everywhere)

commitment     = Poseidon(1, Poseidon(identity_nullifier, identity_trapdoor))
assert LeanIMT root(commitment, path) == merkle_root
assert vote ∈ {0,1}
nullifier_hash = Poseidon(Poseidon(2, scope), identity_nullifier)
```

- `scope = keccak256(chainid, votingContract, proposalId) >> 8` is computed **by
  the contract**, not the voter. A member's nullifier is therefore different on
  every proposal and every deployment.
- `vote` is a public input, so the proof is bound to it. A relayer can't flip
  a ballot or move it to another proposal. The test suite checks both.
- `merkle_root` is the proposal's **snapshot root**, frozen at `createProposal`.
- Hashes are circomlib-compatible Poseidon everywhere: Noir `poseidon::bn254::hash_2`,
  `poseidon-solidity` PoseidonT3 inside LeanIMT, and `poseidon-lite` in Node.
  Parity is checked by the tests and the demo. Solidity-computed commitments
  go into the onchain tree, the Node-rebuilt tree must reproduce its root, and
  the Noir proof must verify against that root.
- Proofs use bb's **`evm` target (keccak, zero-knowledge)** for both the
  verifier and `generateProof`. The non-ZK targets (`evm-no-zk`, or the
  deprecated bb.js `{ keccak: true }`) are not guaranteed to hide the witness,
  and here the witness is the voter's identity.
- UltraHonk needs no circuit-specific trusted setup, so no ceremony is needed
  for this circuit.

## End-to-end: one member, one proposal

Cast: **Alice** (member, NFT wallet `W_A`, token 7), the **DAO admin** wallet,
**Bob** (another member, the proposer), and a **relayer** wallet `R`. `R` is
not a member wallet and was not funded by one.

### 0. One-time setup (not per vote)

| # | Onchain tx | Sent by | A chain observer learns |
|---|---|---|---|
| 0a | Deploy `HonkVerifier`, `PoseidonT3`/`LeanIMT` libraries, `AnonymousVoting(nft, verifier, minAnonymitySet)` | DAO admin | Contract addresses, the verifier's embedded VK (which circuit is accepted), `minAnonymitySet`. |
| 0b | `MembershipNFT.mint(W_A)` (already happens today) | DAO admin | `W_A` is a member. This is public by design. |

### 1. Alice joins the vote (once, ever)

**Offchain, on Alice's machine** (`member-register.mjs`): two random field
elements, `identity_nullifier` and `identity_trapdoor`, are generated and
saved in a note file (`notes/member-7.json`, mode 600, gitignored). The script
computes `commitment = Poseidon(1, Poseidon(n, t))`. The note is saved *before*
the transaction is sent. If Alice loses it she can't vote. Anyone who steals it
can vote as her.

| # | Onchain tx | Sent by | A chain observer learns |
|---|---|---|---|
| 1 | `register(7, commitment)` | **Alice's NFT wallet `W_A`** (it has to be, because the contract checks `ownerOf(7) == msg.sender`) | "Token 7 / `W_A` enrolled commitment `C` at leaf *i*" (from the `MemberRegistered` event), the new tree root, and when she enrolled. **Not** her secret. `C` is a hiding hash and nothing later refers to it except inside a ZK proof. |

This link from wallet to commitment is harmless on purpose. The anonymity set
is exactly this public list of enrolled members. Each token can enroll only
once.

### 2. A proposal opens

| # | Onchain tx | Sent by | A chain observer learns |
|---|---|---|---|
| 2 | `createProposal(bobToken, keccak(text), deadline)` | **Bob's NFT wallet** (any member may propose) | Bob proposed it. The description hash and deadline. `snapshotRoot`/`snapshotSize` = the exact set of enrolled members who can vote, which is the set each ballot hides in. The proposal's `scope`. The call reverts if `snapshotSize < minAnonymitySet`. |

Members who enroll after this point can't vote on this proposal, but can vote
on later ones. The snapshot stops anyone from shrinking the anonymity set
mid-vote.

### 3. Alice votes (`member-vote.mjs`)

All offchain, on Alice's machine, with the secret never leaving the process:

1. Read `getProposal(id)` for the snapshot root and size, the scope and the
   deadline.
2. Replay `MemberRegistered` events, rebuild the LeanIMT from the first
   `snapshotSize` leaves, check the root matches, and find her leaf by value.
3. Compute `nullifier_hash = Poseidon(Poseidon(2, scope), n)`.
4. Run NoirJS to produce the witness, then bb.js `generateProof(..., { verifierTarget: "evm" })`.
   This takes about 0.7 s on a laptop and gives an 8,384-byte proof. Then
   verify locally and check that `publicInputs` equals `[root, scope, vote, nullifier]`.
5. POST `{proposalId, support, nullifierHash, proof}` to the relayer.

Every RPC read in steps 1–2 is identical for every member, so the RPC operator
learns only that "someone is preparing to vote". The script intentionally does
**not** call `nullifierUsed(myNullifier)`: that call would show the RPC
operator Alice's IP address next to the nullifier that later appears in the
public ballot.

The relayer learns the ballot, which contains no identity, plus the HTTP
client's IP. `relayer.mjs` doesn't log IPs, but members shouldn't have to trust
that, so they should reach the relayer over Tor or a VPN.

| # | Onchain tx | Sent by | A chain observer learns |
|---|---|---|---|
| 3 | `castVote(id, support, nullifierHash, proof)` | **Relayer wallet `R`** (or any wallet with no onchain link to Alice, via `SENDER_PRIVATE_KEY`; the script refuses `W_A` and any wallet holding a membership NFT) | That **some** member of the snapshot set voted `yes`/`no`, when that happened, and a nullifier. The nullifier looks random, can't be linked to Alice's commitment, and is different for each proposal, so ballots can't be linked across proposals either. `tx.from` is `R`, which is shared by every voter who uses it. The observer does **not** learn which member voted. |

The contract checks, in this order: the proposal exists, the deadline hasn't
passed, the nullifier is canonical (`< r`), the nullifier is unused, and
`verifier.verify(proof, [snapshotRoot, scope, vote, nullifierHash])`. Only
after all of that does it mark the nullifier and increment the count. A second
ballot from Alice fails with `AlreadyVoted`, whatever sender or relayer she
uses.

### 4. Tally

| # | Onchain tx | Sent by | A chain observer learns |
|---|---|---|---|
| — | none: `tally(id)` is a view (`scripts/tally.mjs`) | anyone | `yes`, `no`, and `eligible` (the snapshot size) once `block.timestamp >= deadline`. |

The deadline gate on `tally()` is cosmetic. Each `VoteCast` event already shows
its yes/no publicly, so **the running count is visible while voting is open.**
That doesn't identify anyone, but it does mean the DAO doesn't get sealed
ballots. See the limitations below.

### Summary: who is linked to what

| Public link | Exists? |
|---|---|
| Member wallet ↔ commitment | Yes (registration). Harmless. |
| Member wallet ↔ proposal authorship | Yes, for the proposer only. |
| Commitment ↔ ballot | **No.** Only a ZK proof over the whole snapshot set. |
| Ballot on proposal A ↔ ballot on proposal B (same member) | **No.** The per-proposal scope gives different nullifiers. |
| Ballot ↔ sending wallet | Yes, but the sender is a shared relayer or a fresh unlinked wallet. |
| Member ↔ "did they vote at all" | **No.** Turnout is public, but not who turned out. |

## What privacy still depends on (read before production)

These are properties of the deployment and of member behaviour that no
contract can enforce:

1. **Never send `castVote` from the member wallet, or from any wallet it
   funded or interacted with.** Use the relayer. The script blocks the obvious
   mistakes but can't see funding history.
2. **Network metadata.** The relayer, and the RPC endpoint if self-sending,
   sees IP addresses. Use Tor or a VPN. If the DAO runs the relayer, "including
   us" relies on that.
3. **Run the prover locally from code you can audit.** A hosted web page served
   by the DAO could exfiltrate note secrets. That would let whoever runs it
   recompute every member's nullifiers and so every vote.
4. **Ballot timing.** Ballot times are public. If someone knows when Alice
   voted (she said "just voted" in chat, or the relayer saw her request at
   14:02), the ballot at 14:02 is hers. Mitigations: `RELAY_JITTER_MS` on the
   relayer, and a reasonable crowd voting in the same window.
5. **The tally itself.** Publishing counts can reveal individual votes. If
   turnout is 20 and the result is 20–0, every voter voted yes. The same goes
   for "0 no votes", or a turnout of 1. Crypto can't fix this; only a large
   turnout and non-unanimous results help.
6. **Anonymity-set size.** `minAnonymitySet` (default 100 in the deploy script,
   5 in the demo) stops proposals from opening on a tiny registry. With 150
   members, get everyone enrolled early.
7. **Honest NFT issuance.** Whoever mints NFTs could mint to sock-puppet
   wallets and enroll fake commitments. That forges votes and makes the
   anonymity set look bigger than it really is. Members should check that
   every `MemberRegistered.tokenId` belongs to someone on the public registry.
   (No admin can add leaves directly: `register` requires `ownerOf(tokenId) == msg.sender`.)
8. **Not receipt-free.** A member can *prove* how they voted to a briber by
   revealing their note. Preventing that needs a MACI-style coordinator, and
   that coordinator can see every vote, which conflicts with "including us".
   This build deliberately doesn't do that.
9. **Membership changes.** The tree is append-only. A member who leaves keeps
   their commitment, so they can still vote. A transferable NFT's new holder
   can't re-enroll the same token. For revocation you would deploy a new
   `AnonymousVoting` (a new epoch) and have current members re-register.
   `MembershipNFT` here is soulbound for this reason.
10. **Cost.** `castVote` is about 2.5M gas (the Honk verifier dominates), so a
    fully voted 150-member proposal costs about 375M gas, paid by the relayer.
    That's fine on an L2 but expensive on L1. `register` is about 150k gas and
    `createProposal` about 175k.

## Implementation notes / gotchas hit

- Poseidon `v0.2.6` doesn't compile under nargo 1.0.0-rc.2, so `v0.3.0` is used.
- `@zk-kit/lean-imt.sol` is installed under the npm alias
  `zk-kit-lean-imt-sol`, because forge mangles remapping targets whose
  directory name ends in `.sol`.
- `via_ir` hits stack-too-deep inside the generated verifier, so it's disabled.
  The optimizer alone keeps the verifier at 18.1 KB, under EIP-170.
- The generated verifier *reverts* (e.g. `SumcheckFailed`) on a bad proof
  rather than returning `false`. `AnonymousVoting` handles both.
- `ffi = true` is set in `foundry.toml` so the tests can call NoirJS for real
  proofs.
