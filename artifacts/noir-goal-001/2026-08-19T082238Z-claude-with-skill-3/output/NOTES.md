# One member, one proposal, end to end

The DAO has 150 members. Membership is public: each wallet holds a membership NFT
and the registry is on the website. None of that changes. What changes is that a
vote is no longer an act performed *by a wallet*.

The whole design rests on one split:

* **Joining** is public and attributable, and happens once, from the member's own wallet.
* **Voting** is anonymous and unattributable, and happens from a wallet that is not theirs.

Everything below follows one member — call her the voter, holding membership NFT #73 —
through proposal #0.

---

## The transactions

Five transactions matter. For each: who sends it, and what someone reading the chain
learns from it.

### TX 0 — Deploy (one time, ever)

| | |
|---|---|
| **Sender** | The DAO's deployer wallet |
| **Call** | `forge script script/Deploy.s.sol` → `MembershipNFT`, `PoseidonT3Hasher`, `HonkVerifier`, `MemberRegistry`, `AnonymousBallot` |
| **Observer learns** | The system exists, and its parameters: tree depth 10, `minAnonymitySet`, and the verification key baked into `HonkVerifier`. |

`HonkVerifier` is the real generated verifier (`bb write_solidity_verifier`). There is
no mock verifier anywhere in the deploy path or the tests — a mock left in a deploy
script is how a system ships that accepts any bytes as a proof.

Note what the deployer does *not* get: no admin key over the ballot, no ability to
open a vote, no trapdoor. "Nobody, including us" has to include the deployer, so the
deployer holds nothing that would help.

### TX 1 — Membership NFT issued

| | |
|---|---|
| **Sender** | The DAO admin (or: this already happened, on the DAO's existing collection) |
| **Call** | `MembershipNFT.mint(voter)` |
| **Observer learns** | Voter's wallet holds membership NFT #73. |

Already public. `src/demo/MembershipNFT.sol` is a stand-in so the local deploy has
something to point at; in production you pass the real collection's address and the
contracts only ever call `ownerOf`.

### TX 2 — The voter joins the vote (`register`)

| | |
|---|---|
| **Sender** | **The voter's own wallet** — the one holding NFT #73 |
| **Call** | `MemberRegistry.register(73, commitment)` |
| **Observer learns** | "The wallet known to be member #73 published the 32-byte value `commitment`, which landed at leaf 73 of the member tree." |
| **Script** | `client/register.js` |

Before this, on her own machine:

```
secret   = random field element      # never leaves the machine
trapdoor = random field element      # never leaves the machine
commitment = Poseidon(secret, trapdoor)
```

and both preimages are written to a note file (`client/notes/member-73.json`). That
file is the only thing that can ever vote as her. There is no recovery path: lose it
and she is silently disenfranchised on every future proposal.

**Sending this from her own wallet is deliberate, and it is safe.** Membership is
already public, so hiding "member #73 joined" would buy nothing. And a commitment is
not a vote — it is the hash of two random field elements. The observer cannot invert
it, cannot guess it (both preimages are full-width random, so there is no small domain
to brute-force), and, crucially, will never see it again: no later transaction mentions
this commitment.

The registry keys registration on the **NFT id**, not the wallet — one membership NFT
buys exactly one commitment, forever. Keying on the wallet would let a member register,
transfer the NFT, and have the recipient register a second commitment, giving that NFT
two votes.

That choice has a consequence to be aware of: registration is permanent per token, so
if the NFT is later transferred, voting power stays with whoever holds the original
secret, not with the new owner. For a soulbound membership NFT — what the demo contract
is, and what a DAO of this shape usually wants — that is exactly right. If your
membership NFT is transferable, this registry is not yet correct for you: it needs a
way to retire a leaf on transfer, which means either an epoch-per-transfer rebuild or
in-circuit revocation, and neither is in here.

What must never happen is the mirror image — acting from the known wallet. That is
TX 4.

### TX 3 — A proposal is opened

| | |
|---|---|
| **Sender** | Any member's own wallet (the proposer's) |
| **Call** | `AnonymousBallot.createProposal(tokenId, description, votingPeriod)` |
| **Observer learns** | Who proposed what, when voting closes, the Merkle root of the member set, and how many members are in it. |

The proposal **freezes the member tree root and the member count** at this moment.
That snapshot is the anonymity set: every vote on proposal #0 proves membership of
*this exact* set of 150, so every vote could have come from any of the 150. Members
who register later are not in it and cannot vote on this proposal — they vote on the
next one.

`createProposal` reverts with `AnonymitySetTooSmall` if fewer than `minAnonymitySet`
members have registered. A "private" ballot whose anonymity set is 3 people is not
private, and the contract refuses to pretend otherwise rather than leaving it to
whoever opens the proposal to notice.

Who proposed is attributable. That is fine — proposing is not voting.

### TX 4 — The vote (`castVote`)

| | |
|---|---|
| **Sender** | **A relayer.** Not the voter. Not any wallet the voter has ever funded or touched. |
| **Call** | `AnonymousBallot.castVote(0, nullifierHash, support, proof)` |
| **Observer learns** | "Somebody in the 150-member snapshot voted yes." Nothing more. |
| **Script** | `client/vote.js` |

On the voter's machine, all of it local:

1. **Read the proposal's snapshot** — root, member count, deadline.
2. **Rebuild the member tree from `MemberRegistered` events**, replaying only the first
   `snapshotMemberCount` leaves, into the mirror in `client/src/tree.js`. The client
   asserts the root it computes equals the root the proposal froze.
   The contract deliberately does *not* offer "give me the Merkle path for leaf 73":
   asking that question tells whoever answers it which leaf is yours. She downloads
   every registration event — the same bytes everyone else downloads — and derives her
   own path locally.
3. **Derive the nullifier**: `nullifierHash = Poseidon(secret, proposalId)`.
4. **Prove**, in-process, with NoirJS + `bb.js`'s `UltraHonkBackend` (WASM). The same
   code runs unchanged in a browser; nothing shells out to a `bb` binary, because the
   real client is a web page and the secret must not leave the device.

The proof's statement is:

> I know a `(secret, trapdoor)` whose `Poseidon(secret, trapdoor)` sits at some leaf of
> the tree with this root, and `nullifierHash` is `Poseidon(secret, proposalId)`, and
> `vote` is 0 or 1.

Public inputs, in this order in all three layers (circuit `pub` params, client, and the
array the contract builds): `[root, proposalId, nullifierHash, vote]`.

Then she hands `(proof, nullifierHash, support)` to a relayer over the network, and the
**relayer** sends the transaction.

**Why the relayer is not optional.** The proof hides which of the 150 commitments is
hers. `msg.sender` does not. If she sent her own vote, the chain would read
"member #73's wallet called castVote with support=true", and the zero-knowledge proof
would have bought exactly nothing. The gas payment alone re-links her.

A burner wallet is not a fix. If she funds a burner from her own wallet, the funding
transaction is the link, one hop away and trivially followed. What is needed is an
address with no funding trail back to any member: a shared relayer service, or an
ERC-4337 bundler with a paymaster. `castVote` is permissionless precisely so that any
relayer works and no one can be shut out of voting by a gatekeeper — the contract never
records who sent it.

**What the relayer can and cannot do.** It sees `(proof, nullifierHash, support)` and
her IP. It does **not** learn who she is — the proof is zero-knowledge and the
nullifier is a hash of a secret it never sees. It cannot alter her vote: `support` is a
public input bound into the proof, so flipping it makes the proof fail
(`test_relayerCannotFlipTheVote`). It *can* refuse to submit — censorship, not
deanonymization — which is why she can walk to a different relayer, or, as a last
resort on a contested vote, send it herself and accept the deanonymization.

**Cost.** Proving takes ~0.4s and produces an 8,000-byte proof. Verifying it onchain
costs ~2.5M gas, paid by the relayer, so the relayer needs a funding model (the DAO
treasury reimbursing it is fine — it learns nothing extra by paying). Registration is
~460k gas, paid once by each member, dominated by the ten Poseidon hashes up the tree.

**Contract-side.** `castVote` checks the deadline, checks `nullifierSpent` and marks it
before the external call, verifies the proof, and only then increments the tally. The
`VoteCast` event carries `(proposalId, nullifierHash, support)` and no address.

**Double voting.** `nullifierHash` is deterministic in `(secret, proposalId)`, so a
second vote on this proposal from the same secret produces the *same* nullifier and
reverts. It is `Poseidon(secret, proposalId)` and not `Poseidon(secret)` on purpose:
without the proposal in the hash, one member's votes across every proposal would share
one nullifier and their whole voting history would link into a single pseudonymous
profile — which is exactly the attribution we are trying to prevent, arrived at the
long way round.

Copying a proof out of the mempool and resubmitting it changes nothing: same nullifier,
already spent, reverts.

### TX 5 — There is no TX 5

After the deadline anyone calls `AnonymousBallot.result(0)`, a plain `view`:

```
(yesVotes, noVotes, turnout, anonymitySet)
```

No reveal phase, no tallying authority, nothing to trust. The count was accumulated
onchain as the proofs verified. `result` reverts with `VotingStillOpen` before the
deadline.

---

## What a chain observer ends up with

* The full public member list: 150 wallets, 150 commitments, who is at which leaf.
* One proposal, its snapshot, its deadline, its final tally.
* 7 `castVote` transactions, all from one relayer address, each carrying a proof, a
  nullifier, and a yes/no.

And no edge whatsoever between the left-hand list and the right-hand one. The
nullifiers are hashes of secrets that never appeared onchain; the commitments never
appear again after registration. There is no key that opens this — not the deployer's,
not the relayer's, not ours.

---

## What this does *not* hide

Worth being blunt about, because these are the parts an "anonymous voting" label tends
to paper over.

**Individual vote choices are public as they are cast.** The design hides *who*, not
*what*. Each `castVote` publicly says "someone voted yes", so a running tally is
visible before the deadline. If you also need the tally hidden until close, you need a
second round (commit a hidden vote, reveal after the deadline) or homomorphic
aggregation — a different and much heavier system. `result()` is gated on the deadline,
but that is a convenience, not a secret: the running tally is derivable from events.

**Unanimity deanonymizes everyone.** If all 150 vote and the tally is 150–0, every
member's vote is known — from the tally alone, without breaking anything. This is true
of every voting scheme that publishes a count. Lopsided tallies leak proportionally.

**The anonymity set is only as large as the turnout is plausible.** 7 votes out of 150
means each vote hides among 150 *possible* voters, which is the guarantee the proof
gives. But if you know by other means that only 8 members were awake that week, the
effective set is 8. Anonymity is bounded by what an observer knows outside the chain.

**Timing and network metadata.** The relayer sees each voter's IP and the exact moment
they voted. A relayer that logs, correlated against, say, a Discord conversation, is a
real deanonymization channel. Members should reach the relayer over Tor or a mixnet,
and a batching relayer that holds votes and submits them in shuffled groups is
strictly better than one that forwards instantly.

**The relayer is a censor.** It cannot forge or alter a vote, but it can drop one.
Multiple independent relayers, or a 4337 bundler market, is the mitigation.

**Registration timing.** Registering right before voting narrows nothing by itself
(the tree is snapshotted at proposal creation), but a member who is the *only* one to
register in a window and then the *only* new leaf in a proposal's set stands out.
Registration should happen in a batch, well before any contested proposal.

**Lost notes are lost votes.** No recovery, by construction. If the DAO could restore a
member's secret, the DAO could also vote as them and could deanonymize them.

**Soundness rests on the KZG setup.** UltraHonk uses the universal Aztec SRS. That is
an assumption about *forging* proofs (voting without being a member), not about
privacy — but it is an assumption, and it is not a ceremony you run per-circuit.

---

## The three-layer hash agreement

Every layer hashes with the *same* Poseidon — BN254, circomlib parameters, t = 3:

| Layer | Call |
|---|---|
| Circuit | `poseidon::poseidon::bn254::hash_2` (`circuits/vote/src/main.nr`) |
| Contract | `PoseidonT3Hasher.hash` (vendored from `poseidon-solidity`) |
| Client | `poseidon([a, b])` from `circomlibjs` (`client/src/poseidon.js`) |

Poseidon2 is a *different* function with different output. Swapping it in on one layer
only produces a tree the other two cannot agree with, and the failure surfaces late and
confusingly, as "valid proofs that do not verify". So the same four hash vectors — one
leaf hash, one parent hash, the empty depth-10 root — are pinned in all three places
(`poseidon_vectors` in the circuit, `PoseidonParity.t.sol`, and a startup check in
`client/src/poseidon.js`), and the leaf order is `(left, right)` everywhere.

`AnonymousBallot.t.sol` closes the loop: it builds the tree onchain from commitments,
and verifies a **real** proof generated by the client against the **real** generated
verifier, asserting the onchain root equals the one the JS mirror computed.

---

## Running it

```bash
npm install
npm run circuit:build          # nargo compile + bb write_vk + regenerate HonkVerifier.sol
npm run circuit:test           # Noir unit tests
npm run contracts:test         # forge tests, real proof against the real verifier

anvil                          # in another terminal
npm run deploy:local
node client/demo.js            # 150 members register, 7 vote, tally read after the deadline
```

Single member, the two scripts that matter:

```bash
node client/register.js --token 73 --account 173 --note client/notes/member-73.json
node client/vote.js --proposal 0 --support yes --note client/notes/member-73.json
```

`client/export-fixture.js` regenerates the proof fixture the Solidity tests use; re-run
it after any change to the circuit.
