# One member, one proposal, end to end

This is the whole life of a single ballot: what the member does, which wallet
signs each transaction, and exactly what someone watching the chain can work
out from it.

Cast of wallets:

| name | who holds it | ever linked to the member? |
| --- | --- | --- |
| **DAO deployer** | the DAO multisig | n/a |
| **member wallet** | the member; holds the membership NFT | yes, publicly — that is the point of the NFT |
| **relayer** | a third party, or the member's own throwaway | **must not be** |

The design in one line: membership is proved against a Merkle tree of identity
commitments, so a ballot proves *"I am one of the 150"* without saying which
one — and the transaction that carries it is sent by someone else.

---

## Step 0 — deployment (one time)

**Tx: `Deploy.s.sol` → `MembershipNFT`, `RegisterVerifier`, `VoteVerifier`,
`MemberRegistry`, `Ballot`, then 150 × `MembershipNFT.mint`.**
Sent by: **DAO deployer**.

A chain observer learns: the contracts exist, and which 150 addresses hold a
membership NFT. This was already public on the DAO's website, so nothing is
lost. Note what the DAO does *not* get: no admin key over the registry root, no
pause switch on the ballot, no way to open a proposal against a set it made up.

## Step 1 — the member creates a secret (no transaction)

`js/join.js` draws a uniformly random BN254 field element `secret` and stores it
in `.secrets/`. It never leaves the machine.

    commitment = Poseidon2(secret)

`commitment` is hiding — it reveals nothing about `secret` — and binding — the
member cannot later claim a different one.

## Step 2 — joining the anonymity set

**Tx: `MemberRegistry.join(commitment, newRoot, proof)`.**
Sent by: **the member's own wallet** — the one holding the NFT.

The contract checks the sender holds a membership NFT and has not joined
before, then verifies a `register` proof: *"slot `index` of the tree rooted at
`root` is empty, and filling it with `commitment` gives `newRoot`."* The
contract supplies `root` and `index` from its own storage, so the only value the
caller chooses is their own commitment.

A chain observer learns:

- this member has joined the vote (their address, from `msg.sender`);
- their leaf index and their commitment (`Joined` event);
- the new registry root.

A chain observer does **not** learn the secret, and — importantly — nothing here
will ever link to a ballot. The commitment appears in exactly one later place:
inside a zero-knowledge proof, where it is invisible.

This step is deliberately public. Trying to hide *who joined* would be
self-defeating: the anonymity set has to be publicly checkable, or a voter can't
tell whether they are hiding among 150 people or among one.

> Why no operator posts the root: the EVM has no cheap Poseidon2, so the
> contract cannot recompute the tree. Rather than trust a signer to publish
> roots — which would let the DAO publish a root containing a single member and
> deanonymise them — every joiner proves their own insertion. There is no
> privileged party anywhere in the registry.

## Step 3 — a proposal is opened

**Tx: `Ballot.createProposal(descriptionHash, votingPeriod)`.**
Sent by: **any member's wallet** (ordinary, attributable DAO business).

`Ballot` reads `registry.root()` and `registry.memberCount()` itself and
snapshots them. It refuses if fewer than `minAnonymitySet` members have joined.

A chain observer learns: who opened the proposal, what it is about, the snapshot
root, how many members are in the set, and the deadline. Members who join after
this transaction cannot vote on this proposal.

## Step 4 — the member builds a ballot (no transaction)

All local, in `js/vote.js`:

1. Read `proposalInfo(id)` → `(root, memberCount, deadline)`.
2. Read `registry.allCommitments()`, keep the first `memberCount` — the registry
   is append-only, so that prefix *is* the snapshot.
3. **Rebuild the tree and refuse to continue unless it hashes to `root`.** This
   is the check that makes the anonymity set real; without it a bad root could
   single the member out.
4. Find own leaf index by locating `Poseidon2(secret)` in the list.
5. `context = keccak256(chainid, ballotAddress, proposalId) >> 8`, read from the
   contract, and `nullifier = Poseidon2(secret, context)`.
6. Prove the `vote` circuit.

   | | value | |
   | --- | --- | --- |
   | public | `root` | must equal the proposal's snapshot |
   | public | `proposal_context` | ties the proof to this chain, this Ballot, this proposal |
   | public | `vote` | 0 or 1 — constrained boolean |
   | public | `nullifier_hash` | one per (member, proposal) |
   | private | `secret` | |
   | private | `index`, `siblings` | **which member this is** |

The proof is ~7.2 KB. It says: *there exists a leaf of `root` whose preimage I
know, and this nullifier is its tag for this proposal.* Nothing more.

## Step 5 — the ballot goes on chain

**Tx: `Ballot.castVote(proposalId, support, nullifier, proof)`.**
Sent by: **the relayer** — never the member's wallet.

`Ballot.castVote` does not read `msg.sender` at all. It checks the deadline, the
nullifier has not been used for this proposal, and the proof verifies against
`[snapshotRoot, proposalContext, support, nullifier]`. Then it bumps a counter.

A chain observer learns:

- the relayer's address, and that it paid ~2.4M gas;
- **the ballot direction** (`support` in the `VoteCast` event);
- a nullifier, which is a Poseidon2 output over a secret they do not have —
  uniformly random as far as they are concerned, and uncorrelated with this
  member's nullifier on every other proposal;
- that the voter is one of the `memberCount` members in the snapshot.

A chain observer does **not** learn which leaf, which commitment, or which
member wallet. Neither does the DAO: it has exactly the same view. There is no
key anywhere that decrypts this.

Two things the relayer *also* cannot do, because both are public inputs bound
into the proof: change the vote, or point the ballot at a different proposal.
`js/demo.js` step 6 shows a relayer trying to flip a yes into a no and the
transaction reverting inside the verifier.

## Step 6 — the tally

**No transaction.** `Ballot.tally(id)` is a view call that reverts until
`block.timestamp >= deadline`, then returns `(yesVotes, noVotes)`.

Gating `tally()` is about composability, not secrecy: it stops another *contract*
from branching on a half-finished vote. A human can add up `VoteCast` events, or
read the storage slot directly, at any time. See "running tally" below.

---

# What this does and does not protect

## Holds

- **Nobody can attribute a ballot to a member — including the DAO.** The link
  between a member and their ballot exists only inside the proof, which is
  zero-knowledge, and inside the member's own `.secrets/` file.
- **One ballot per member per proposal**, enforced by the nullifier.
- **Ballots are unlinkable across proposals.** `Poseidon2(secret, contextA)` and
  `Poseidon2(secret, contextB)` cannot be tied together, so nobody can build a
  voting history for "member #7" even without knowing who that is.
- **Nobody can forge the anonymity set.** Every root is the result of a verified
  insertion, and the voter re-derives it from the published commitments before
  voting.
- **A relayer cannot tamper.** `vote` and `proposalContext` are public inputs.

## Does not hold — read this part

1. **The member must not send `castVote` themselves.** Everything above collapses
   if they do. `js/vote.js` signs with a separate wallet for exactly this reason.
2. **Gas for that wallet must not come from the member's wallet.** A funding
   transfer re-links them just as effectively. Use a real relayer that the member
   contacts over HTTPS/Tor, or an ERC-4337 paymaster the DAO funds for everyone.
   On the local chain the demo cheats with `anvil_setBalance`.
3. **The relayer learns the ballot and the requester's IP.** It does not learn
   the member's identity unless the member reveals it (by connecting from an
   identifiable address, or by being the only person who asked). It cannot forge
   or alter the vote. Relaying over Tor, or through several relayers, closes the
   gap.
4. **Timing correlates.** A member who joins at 14:02 and whose relayed ballot
   lands at 14:03, alone in the block, has told you a lot. Wait; let ballots
   accumulate; do not vote in registration order.
5. **The anonymity set is who *joined*, not who is a member.** If 9 of the 150
   join, ballots hide among 9. `minAnonymitySet` is a floor, not a solution —
   the fix is to get members to join early and in bulk, well before any proposal
   they care about. Joining is per-registry, not per-proposal, so it is a
   one-off cost.
6. **The running tally is visible.** Each `castVote` publishes its direction, so
   anyone can watch the count move. This does not attribute anything, but it does
   let late voters see where things stand. Hiding it needs encrypted ballots with
   homomorphic or threshold-decrypted tallying — a much larger design, and not
   what was asked for here.
7. **Small or lopsided results self-reveal.** If 3 people vote and the result is
   3–0, everyone who voted knows how everyone else voted. No cryptography fixes
   this; it is a property of publishing a tally.
8. **This is not receipt-free, and not coercion-resistant.** A member who reveals
   their secret can prove how they voted, which means they can also *sell* that
   proof. If vote-buying is the threat you care about, this scheme is not enough
   and you want something in the MACI family (ballots encrypted to a coordinator
   key, with key-change to invalidate receipts) — at the cost of introducing a
   coordinator who *can* see individual votes.
9. **Trust in the toolchain.** Soundness rests on UltraHonk, Barretenberg's
   generated verifier, and the BN254 SRS. The ZK (`-t evm`) proving mode is
   mandatory here: the non-ZK variant can leak witness data, and the witness is
   the member's identity.
10. **Membership churn.** Leaves cannot be removed. A member who leaves the DAO
    can still vote on proposals whose snapshot predates their departure; one who
    joins the DAO after a snapshot cannot vote on it. Deploy a fresh registry
    when the roster changes materially. Likewise, one NFT is one leaf is one
    ballot: someone holding two membership NFTs in two wallets gets two votes.
    That is the DAO's membership model showing through, not something the
    ballot can detect.

---

# Numbers

| | |
| --- | --- |
| tree depth / capacity | 8 / 256 leaves (DAO has 150 members) |
| `register` circuit | 4,008 gates |
| `vote` circuit | 3,548 gates |
| proving time | ~0.2 s per proof on a laptop |
| proof size | 7,232 bytes |
| `join` gas | ~2.44M |
| `castVote` gas | ~2.38M |
| `createProposal` gas | ~128k |

The gas is almost entirely the UltraHonk verifier (~2.2M of each). It is paid
once per member to join and once per member per proposal to vote. On mainnet
that is the number to argue about; on an L2 it is unremarkable.
