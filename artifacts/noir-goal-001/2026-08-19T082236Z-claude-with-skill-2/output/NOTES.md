# One member, one proposal, end to end

The guarantee this system actually delivers:

> For any proposal, an observer with the full chain history, the public member registry,
> and the DAO's own private records can determine **how many** members voted yes and no,
> and **nothing about which member cast which ballot** beyond the fact that every ballot
> came from someone in the snapshotted electorate.

That holds against the DAO itself. There is no admin key, no tallying committee, and no
trusted server anywhere in the path — the only thing that authorises a ballot is a
zero-knowledge proof, and the only party who can make one is the member.

Section 5 lists what an observer *can* still infer. Read it; some of it is inherent to any
public tally and some of it is on you to operate correctly.

---

## 1. The cast

| Wallet | Who | Publicly known? |
|---|---|---|
| **DAO admin** | deploys the contracts, mints membership badges | yes |
| **Member wallet** | holds the membership NFT; listed in your public registry | yes, by design |
| **Relayer** | submits ballots on behalf of members; holds no badge, votes on nothing | yes, but linked to no member |

The member wallet and the relayer must never be the same party, and the relayer must not
be funded by the member. That is the entire hinge of the design — see section 4.

## 2. Contracts

```
MembershipNFT   one non-transferable badge per member. Public by design.
      ^
VoterRegistry   depth-10 Poseidon Merkle tree of voter commitments. Members insert
      ^         their own leaves. Emits CommitmentAdded so clients can mirror it.
AnonVoting  ->  HonkVerifier   proposals, ballots, tally. castVote() checks no msg.sender
                               at all; the proof is the authorisation.
```

Wiring is constructor-only and `immutable`. There is no `setVerifier()`, so the admin
cannot later swap in a permissive verifier and forge a tally.

---

## 3. The flow

### Step 0 — Deploy and mint badges

**Transaction:** `MembershipNFT`, `VoterRegistry`, `HonkVerifier`, `AnonVoting` deployments,
then one `MembershipNFT.mint(member)` per member.
**Sent by:** the DAO admin wallet.
**An observer learns:** the full member roster and the contract addresses. This is already
public on your site; nothing is lost.

### Step 1 — The member derives their secret. *Offchain.*

The member signs a fixed message (`IDENTITY_MESSAGE` in `js/lib/note.mjs`) with their member
wallet. Two field elements are derived from that signature:

```
secret      = keccak(sig ‖ "|secret")     mod p
nullifier   = keccak(sig ‖ "|nullifier")  mod p
commitment  = Poseidon(secret, nullifier)
```

Deriving from a signature rather than fresh randomness means the member can always recover
their identity by re-signing — losing the note file is not fatal. The note is still persisted
(`notes/<address>.json`, gitignored) because it caches the one thing that is *not* derivable:
the leaf index the contract assigns next.

Nothing is sent. Nothing leaves the member's machine.

### Step 2 — The member joins the voter set

**Transaction:** `VoterRegistry.join(tokenId, commitment)` — `js/join.mjs`
**Sent by:** **the member's own wallet.** This is correct and deliberate.
**An observer learns:**

- that this specific, named member has joined the voter set, and
- the leaf index they were assigned, and
- their `commitment`, a 32-byte hash.

They learn nothing about any future ballot. `commitment` is a Poseidon hash of two secrets;
the preimage domain is the full scalar field, so it is not brute-forceable even though your
membership list is completely public.

It is fine — necessary, even — that this transaction is attributable. Someone must prove
badge ownership to earn a leaf, and only the member can do that. Joining is a public act
like registering to vote. **Voting** is the private act.

Enforced here: one leaf per badge (`hasJoined[tokenId]`), badge must be owned by the caller,
and the badge is non-transferable so nobody can collect several and vote several times.

### Step 3 — Someone opens a proposal

**Transaction:** `AnonVoting.createProposal(descriptionHash, deadline)` — `js/propose.mjs`
**Sent by:** any member's own wallet (the contract requires a badge).
**An observer learns:** the proposal text hash, the deadline, and the registry root plus
electorate size frozen at this instant.

The snapshot matters for privacy, not just for correctness. Every ballot on this proposal
quotes the *same* root, so the root in the calldata distinguishes no voter from another.
The obvious alternative — "accept any root from the last N days" — would leak: each voter's
choice of root narrows them to the members who had joined by that point.

Consequence to plan around: a member who joins *after* a proposal opens cannot vote on it.
Join early; the anonymity set for a proposal is exactly the electorate at its creation.

### Step 4 — The member builds their ballot. *Offchain.*

`js/vote.mjs`, all local:

1. Replay `CommitmentAdded` logs **up to the proposal's creation block** into an offchain
   Merkle mirror (`@zk-kit/imt`), and assert the mirror's root equals the proposal's snapshot.
   The contract never hands out Merkle paths — asking one for a path would itself be an
   observable act announcing who is about to vote.
2. Derive the Merkle witness for the member's own leaf.
3. Compute `nullifierHash = Poseidon(nullifier, proposalId)`.
4. Prove, in-process, with NoirJS + `bb.js` (`{ verifierTarget: "evm" }`). ~370 ms warm,
   8000-byte proof, 16K-gate circuit. This module runs unchanged in a browser bundle — which
   is where it belongs, because a member who posts their secret to a server-side prover has
   no privacy from that server.
5. Verify the proof locally before spending any gas.

The circuit proves, without revealing the leaf:

- the member's commitment is in the snapshotted tree,
- `nullifierHash` is correctly derived from that same commitment's nullifier and this
  proposal id, and
- the ballot is a bit, `0` or `1`.

### Step 5 — The relayer submits the ballot

**Transaction:** `AnonVoting.castVote(proposalId, nullifierHash, support, proof)` — `js/vote.mjs`
**Sent by:** **the relayer. Never the member.** ~844k gas.
**An observer learns:**

- one more member of this proposal's electorate has voted,
- which way that anonymous ballot went (`support` is public),
- a `nullifierHash` that is unlinkable to any member and unlinkable to that member's
  ballots on every other proposal,
- the relayer's address and the block timestamp.

They do **not** learn which leaf, which commitment, which badge, or which wallet.

The contract counts the vote only after `verify()` returns true, and records the nullifier
so a replay reverts with `NullifierAlreadyUsed`. Because the nullifier is bound to the
proposal *in-circuit*, the same ballot cannot be replayed onto another proposal either
(`test_ProofCannotBeReplayedOntoAnotherProposal`).

### Step 6 — The tally

**No transaction.** `AnonVoting.tally(proposalId)` is a free view call, permissionless, and
reverts with `VotingStillOpen` until the deadline has passed.

---

## 4. Why step 5 must be relayed

This is the failure that silently voids everything else.

`msg.sender` is public. If a member submitted their own proof, the chain would show
`0xMemberWallet` sending a transaction containing a yes/no bit — and the ZK proof would be
decoration. The proof hides *which leaf* voted; it cannot hide who paid for the gas.

So `castVote` checks nothing about `msg.sender`, and `js/vote.mjs` builds the proof under the
member's key and then hands it to `relayerWallet()` to send.
`test_RealProofIsAcceptedFromAWalletWithNoMembership` pins that the submitter needs no badge.

Two ways to get this wrong that look like fixes:

- **A fresh burner per member.** If the burner is funded from the member's wallet, the
  funding transfer restores the link. A burner is only as anonymous as its funding path.
- **A relayer the DAO runs.** The chain then shows nothing, but the relayer's operator sees
  which member handed it which ballot. That fails "nobody — including us". If you run it
  yourself, the submission channel must be anonymous to the operator too (accept ballots
  over Tor / a mixnet, log nothing, batch), or use an ERC-4337 bundler + paymaster where the
  UserOperation is authorised by the proof rather than by a member-linked signature.

The relayer cannot cheat: it cannot flip the vote bit, swap the nullifier, or forge a ballot,
because all three are bound into the proof (`test_RelayerCannotFlipTheVoteBit`,
`test_RelayerCannotSwapTheNullifier`). It can only refuse to submit or delay — censorship,
not attribution. Mitigate with several independent relayers.

A ballot copied out of the mempool and front-run by a stranger is likewise harmless: the proof
fixes the proposal, the nullifier and the vote bit, so the copy records exactly the ballot the
member intended, and the original transaction then reverts with `NullifierAlreadyUsed`.

---

## 5. What an observer can still infer

Stated plainly, because a privacy system that oversells itself is worse than none.

1. **The running tally is visible before the deadline.** `tally()` reverts early, but each
   ballot's yes/no bit is in public calldata, so anyone can count as they land. This is the
   deliberate tradeoff for a trustless tally: hiding the count until the deadline needs
   homomorphic/threshold encryption and a decryption committee, which reintroduces exactly the
   trusted party this design removes. If a visible running count is unacceptable for contested
   votes, that is the change to make, and it is a real project — not a tweak.
2. **Turnout and who joined are public.** An observer knows the electorate and its size, and
   sees each ballot arrive. With 150 members and 12 ballots, each ballot is anonymous among
   150 — but if only 2 people vote, each is anonymous among 150 while the *result* is
   obviously informative. Anonymity is bounded by the electorate, not by turnout.
3. **The last-voter problem is inherent.** If 149 members publicly announce their votes, the
   150th is determined by arithmetic. No ballot system fixes this.
4. **Timing correlation.** If a member's browser proves and the relayer submits three seconds
   later, and that member is the only one active, timing links them. Relayers should batch and
   add delay/jitter.
5. **Network-level metadata.** `js/vote.mjs` reads chain state via an RPC endpoint. That
   provider sees the member's IP alongside queries for a specific proposal. In production,
   proxy reads, or sync logs in the background regardless of whether the member intends to vote.
6. **Secret compromise is retroactive.** Because secrets are derived from a wallet signature,
   whoever obtains that signature — or the `notes/` file — can recompute every past
   `nullifierHash` and de-anonymise that member's entire voting history. This is the cost of
   recoverable identities. Treat `notes/` like a private key; it is gitignored.

---

## 6. Cross-layer invariants

Three independent implementations of Poseidon have to agree byte-for-byte, or proofs stop
verifying with no diagnostic worth reading:

| Layer | Implementation |
|---|---|
| Circuit | `poseidon::poseidon::bn254::hash_2` (`poseidon` v0.3.0) |
| Solidity | `PoseidonT3.hash` (poseidon-solidity) |
| JavaScript | `poseidon2` (poseidon-lite) |

They do agree — verified, not assumed:
`Poseidon(1, 2) = 0x115cc0f5e7d690413df64c6b9662e9cf2a3617f2743245519e19607a4417189a`, pinned in
`test_PoseidonAgreesWithNoirAndJs` in `test/CrossLayer.t.sol`. The tree root is pinned across layers too
(`test_EmptyRootAgreesWithJsMirror`, `test_RootAfterThreeJoinsAgreesWithJsMirror`).

The other silent seam is **public-input order**, which must match in three places:

```
main.nr        root, proposal_id, nullifier_hash, vote   (all `pub`)
AnonVoting.sol publicInputs[0..3] in that same order
prove.mjs      named inputs handed to Noir.execute
```

`test/AnonVoting.t.sol` replays a real proof from `test/fixtures/vote-proof.json` through the
real generated verifier, so reordering any of the three breaks `forge test` immediately.
Regenerate the fixture with `node js/fixture.mjs` whenever the circuit changes.

Proof serialization must also match: the verifier was generated with
`bb write_solidity_verifier --verifier_target evm` (keccak transcript, ZK), so the prover must
pass `{ verifierTarget: "evm" }`. The default serialization, and the deprecated
`{ keccak: true }` (which means `evm-no-zk`), both produce proofs this verifier rejects.

---

## 7. Where things are

```
circuits/vote/src/main.nr        the ballot circuit (+ an inline nargo test)
contracts/MembershipNFT.sol      public, non-transferable membership badge
contracts/VoterRegistry.sol      depth-10 Poseidon incremental Merkle tree
contracts/AnonVoting.sol         proposals, ballots, nullifiers, tally
contracts/verifier/HonkVerifier.sol   generated by bb; do not hand-edit
script/Deploy.s.sol              stands everything up and wires it, writes deployments/
js/join.mjs                      step 2 — member's own wallet
js/propose.mjs                   step 3 — a member's own wallet
js/vote.mjs                      steps 4+5 — secret -> proof -> relayed transaction
js/tally.mjs                     step 6 — view call
js/demo.mjs                      all of it, against a local chain
js/fixture.mjs                   freezes a real proof for forge test
test/CrossLayer.t.sol            Poseidon + tree parity across the three layers
test/AnonVoting.t.sol            real proof vs real verifier; tamper and replay cases
```

Setup and commands: `README.md`.
