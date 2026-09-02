# One member, one proposal, end to end

This walks a single member from joining the vote through to the published tally, and
names for every onchain transaction **who sends it** and **what someone reading the
chain learns from it**.

The requirement driving every choice here is the one you named: nobody, including the
DAO, should be able to tell how any individual member voted. Sections 1–4 are the
flow. Section 5 is the argument for why the property holds. Section 6 is the honest
list of what still leaks and what you would have to do about it.

---

## 0. The shape of the design, in one paragraph

Membership is public and stays public. Each member publishes a **commitment**
`H(secret)` from their own wallet; the registry hashes all commitments into an
onchain Merkle tree. To vote, a member proves in zero knowledge that *some* leaf of
that tree is theirs, and reveals a **nullifier** `H(secret, proposal)` that stops them
voting twice. The proof carries no leaf index and no commitment, and the nullifier is
a pseudorandom function of a secret only the member knows, so it cannot be matched to
any commitment. The ballot is then submitted by a **wallet that is not the member's**.
That last step is not a detail — it is half of the privacy, and section 6.1 is about
what happens when you get it wrong.

Contracts:

| Contract | Role |
| --- | --- |
| `MembershipNFT` (demo stand-in) | who is a member; in production, your existing NFT |
| `MemberRegistry` | commitment list + onchain incremental Merkle tree |
| `PrivateBallot` | proposals, nullifier spend set, tally |
| `HonkVerifier` (generated) | verifies the Noir proof |

Wiring is by constructor immutable — there is no `setVerifier`, no admin key, and
nothing anyone can re-point after deployment.

---

## 1. Joining the vote — `MemberRegistry.register`

Offchain first, on the member's own machine:

```
secret     = 248 random bits          (never leaves the machine, ever)
commitment = H(secret)
```

Then one transaction.

> ### TX 1 — `MemberRegistry.register(tokenId, commitment)`
> **Sent by:** the member's own wallet — the one holding the membership NFT.
> **Gas:** ~244k for the first registration, ~188k after (10 SHA-256 precompile calls + storage).
>
> **A chain observer learns:** that this named member has joined the private voting
> system; their commitment; their leaf index; the new tree root. Registration is fully
> attributable, and deliberately so — membership is already public on your site, so
> hiding it would buy nothing while making it impossible to prove the tree contains
> only real members.
>
> **A chain observer does not learn:** the secret, or anything that will link this
> member to any future ballot. `commitment = H(secret)` is one-way; every later
> nullifier is `H(secret, ...)`, which nobody can compute or recognise without the
> secret.

Done once. The same registration serves every future proposal — which matters for you,
since you expect many proposals over time.

`register` is keyed on the **token**, not the wallet. Keying on the wallet would let a
transferable NFT be registered twice (register, transfer, new holder registers), which
is both a second vote and an extra tree leaf under one party's control.

---

## 2. Opening a proposal — `PrivateBallot.createProposal`

> ### TX 2 — `PrivateBallot.createProposal(description, votingPeriod)`
> **Sent by:** any member's own wallet. Ordinary, public governance action.
> **Gas:** ~130k.
>
> **A chain observer learns:** who opened it, the text, the deadline, the pinned
> member-tree root, and how many members were registered at that instant.
>
> **A chain observer does not learn:** anything about ballots — none exist yet.

The important thing this transaction does is **pin the root**. Every ballot on this
proposal proves membership against that one root, and the root never moves while
voting is open.

That is a privacy decision, not a bookkeeping one. If the root tracked registrations
during the voting window, each ballot would implicitly announce which registration
window its voter proved against, chopping 150 members into small buckets. A proposal's
anonymity set is fixed, and it is `proposal.eligible` — every registered member, not
just those who end up voting.

---

## 3. Casting the ballot — `PrivateBallot.castVote`

Everything up to the transaction is local and read-only. `js/vote.js` does exactly
this, printing each step:

1. Load the secret.
2. Read the proposal: pinned root, deadline, anonymity set size.
3. **Rebuild the member tree from the registry's `MemberRegistered` events and check
   that the recomputed root equals the pinned root.** Do not skip this and trust
   `registry.root()` — see section 5.2.
4. Find your own leaf, take its authentication path.
5. `scope = H(ballotAddress, proposalId)`, `nullifier = H(secret, scope)`.
6. Prove, with these public inputs and only these:

   | Public input | Value |
   | --- | --- |
   | `root` | pinned member tree root |
   | `vote_scope` | this proposal's domain separator |
   | `nullifier` | `H(secret, scope)` |
   | `vote` | 1 = yes, 0 = no |
   | `relayer` | the address that will submit — nobody else can |

   Private, and absent from the proof: the secret, the commitment, the leaf index, the
   authentication path.

Then the transaction — and this is the one that has to come from somewhere else.

> ### TX 3 — `PrivateBallot.castVote(proposalId, support, nullifier, proof)`
> **Sent by:** a wallet that is **not** the member's — a relayer, or a burner the
> member funded in a way that is not traceable to them. Any address works; the
> contract only requires that it is the address named inside the proof.
> **Gas:** ~922k (proof verification dominates).
>
> **A chain observer learns:** that one of the `eligible` registered members cast a
> ballot; which way it went; a 31-byte nullifier; the submitting address; the time.
>
> **A chain observer does not learn:** which member. There is no leaf index, no
> commitment and no membership NFT anywhere in the calldata, the proof or the event.

Because the submitting address is a public input, a proof sitting in the mempool is
useless to anyone else: it cannot be lifted and re-broadcast from another address, and
a relayer cannot flip `support` on the way through — flipping it invalidates the
proof. Both are covered by tests (`test_rejectsAProofSubmittedByADifferentWallet`,
`test_rejectsAFlippedVote`).

Voting twice fails on the nullifier, which is deterministic in `(secret, proposal)`,
so re-proving does not help. Nullifiers on *different* proposals are unlinkable to
each other, so a member's voting history across many proposals never accumulates into
a fingerprint.

---

## 4. The tally — no transaction at all

`PrivateBallot.tally(proposalId)` is a `view` call. Anyone can read it, no key, no
membership, no permission. It reverts until the deadline passes.

`js/tally.js` prints the result and the list of nullifiers. Each line is a ballot
nobody can attribute.

The full sequence, then:

| # | Transaction | Sender | Reveals |
| --- | --- | --- | --- |
| 0 | `MembershipNFT.mint` (pre-existing) | DAO admin | who is a member |
| 1 | `MemberRegistry.register` | the member's own wallet | that this member joined; their commitment |
| 2 | `PrivateBallot.createProposal` | any member's own wallet | the proposal, deadline, and pinned electorate |
| 3 | `PrivateBallot.castVote` | a relayer or burner — never the member | one anonymous ballot and its direction |
| 4 | `tally` | — (`eth_call`) | the result |

---

## 5. Why the DAO cannot break this either

### 5.1 There is no key that would help

The link between a member and their ballot is `secret`. It is generated on the
member's machine, and the only value derived from it that ever reaches the chain is
`H(secret)` at registration and `H(secret, scope)` at voting. Nothing in the system —
no admin key, no deployer key, no trusted setup artifact — makes it possible to go
from a nullifier back to a commitment. The DAO is in exactly the same position as any
outside observer, because there is no privileged position to occupy. That is what
"including us" requires, and it is why this is not a commit-reveal or an
encrypt-to-a-committee scheme: both of those have someone who can decrypt.

### 5.2 The anonymity set is not something we can curate

This is the attack worth spelling out, because it is where most "ZK voting" designs
quietly fail. If an operator could choose the tree root — for example by computing it
offchain and posting it — they could pack a proposal's tree with commitments they
control, cast those ballots themselves, subtract them from the tally, and narrow the
remaining real ballots down. With enough padding, that fully deanonymises.

So `MemberRegistry` builds the tree **onchain**, one leaf per registration transaction,
each sent by an NFT holder. The root is a pure function of what members themselves
registered; nobody can insert a leaf, and there is no admin function to set the root.
`js/vote.js` also rebuilds the tree from `MemberRegistered` events and refuses to vote
if the recomputed root disagrees with the proposal's pinned root — so the check does
not rest on reading the contract source and trusting it.

This is why the Merkle hash is SHA-256 rather than Poseidon. The same hash has to be
computed inside the circuit, inside the EVM and in Node; SHA-256 is a 60-gas precompile
in the EVM, a `std` gadget in Noir and built into Node, so all three agree by
construction rather than by hand-transcribing round constants. Poseidon would make the
circuit ~40x smaller but would need a hand-ported Solidity implementation, and getting
that subtly wrong is exactly the kind of bug that produces an onchain tree the circuit
disagrees with. The three implementations assert the same test vectors
(`circuits/vote/src/hash.nr`, `test/Hashing.t.sol`, `js/core/hash.js`).

### 5.3 The proof is actually zero knowledge

Barretenberg will happily produce a *non*-ZK Honk proof that this same Solidity
verifier accepts. It leaks information about the witness — and here the witness is the
voter's identity. The verifier target is `evm` (keccak transcript **with** zero
knowledge), not `evm-no-zk`, in both `scripts/build-circuit.sh` and `js/core/prover.js`.
If you change one, change both.

---

## 6. What still leaks, and what to do about it

None of these are hypothetical, and none are fixed by the circuit.

### 6.1 The gas has to come from somewhere — this is the big one

TX 3 is sent by some address, and that address needs ETH. If the member funds a burner
from their own wallet, the funding transaction re-links the ballot to them and the
entire scheme is undone by one transfer. The chain does not care that the vote itself
was anonymous.

Workable answers, roughly in order of how much you have to trust:

- **Run a relayer.** `js/vote.js --print-calldata` stops before sending and prints a
  transaction anyone can broadcast. The proof binds the relayer's address, so the
  relayer cannot alter the vote, cannot re-target the proof, and cannot vote on the
  member's behalf. It *does* see the member's IP and the arrival time, so it should
  accept submissions over Tor and batch them.
- **A shared pool of pre-funded burners**, handed out at registration time, before
  anyone knows what the proposals will be.
- Funding a burner from an exchange withdrawal or a mixer — fine for individuals,
  not something a DAO can instruct 150 people to get right.

Whatever you choose, it has to be uniform. A member who does something different from
everyone else stands out precisely because they did.

### 6.2 Timing and network metadata

If a member fetches the member tree from a public RPC and a ballot lands thirty seconds
later, whoever runs that RPC can correlate the two. Same for a relayer that submits
each ballot the moment it arrives. Mitigations: members run their own node or use a
neutral one; relayers batch and shuffle; voting windows are long enough that arrival
time is not distinguishing. A 72-hour window with 150 members is much better than a
one-hour window with 150 members.

### 6.3 Anonymity set size

A ballot hides among `proposal.eligible` members, not 150. If a proposal is opened when
only six people have registered, it is a one-in-six guess. `js/propose.js` warns below
three registrations and `js/vote.js` warns below two, but the real fix is procedural:
get everyone registered before you run anything contested, and consider requiring a
minimum registration count before proposals can open.

### 6.4 The running tally is public

Ballot direction is a public input, so the yes/no counts move visibly as votes land.
`tally()` is gated until the deadline as a courtesy to consumers, not as a secret —
the `VoteCast` events and the calldata give it away. This does not violate your
requirement (a running count attributes nothing), but it does mean late voters see
where things stand.

Hiding the running tally means encrypted ballots homomorphically summed and decrypted
after the deadline. That reintroduces a decryption key, which someone has to hold — and
whoever holds it can decrypt individual ballots unless you add threshold decryption
across a committee, at which point "nobody including us" becomes "no *quorum* of us".
Given how you stated the requirement, a public running tally is the better trade.

### 6.5 Ballots are not receipt-free

A member can prove how they voted by revealing their secret: anyone can recompute the
nullifier and see it against a `yes` or a `no`. So this resists surveillance but not
a briber who asks for proof. Receipt-freeness is a genuinely harder problem —
re-voting schemes, designated-verifier proofs — and it does not compose with a public
per-ballot direction. Worth knowing before a vote where someone might pay for outcomes.

### 6.6 Losing the secret

There is no recovery. A member who loses their secret cannot vote on any future
proposal, and there is no rotation mechanism — the leaf is in the tree for good.
`Identity.fromPassphrase` exists so members can derive the secret from something
memorable, but a guessable passphrase is worse than a lost one: whoever guesses it can
vote as that member *and* recompute their nullifiers to learn how they voted on every
past proposal. If you ship this, ship a real key-storage story with it.

### 6.7 Membership changes

Registration is permanent. A member who registers and then transfers their NFT keeps
their vote, and the new holder cannot register. Removing a member needs a leaf update
(an onchain Merkle update path, or a nullifier-tree scheme, or simply a fresh registry
per epoch with everyone re-registering). Not built here. If your NFT is transferable,
the simplest interim answer is to make it soulbound.

### 6.8 Cost

~922k gas per ballot, all of it Honk verification. 150 ballots is ~138M gas — a rounding
error on an L2, a real expense on mainnet. The `--optimized` verifier already cut this
from ~2.7M; the next lever is proof aggregation (one onchain verification for a batch
of ballots), which is a substantial piece of work.

---

## Where things are

```
circuits/vote/src/main.nr      the ballot circuit, with its own tests
circuits/vote/src/hash.nr      SHA-256-to-field, cross-checked against Solidity and Node
src/MemberRegistry.sol         onchain incremental Merkle tree over member commitments
src/PrivateBallot.sol          proposals, nullifiers, tally
src/verifiers/HonkVerifier.sol generated - regenerate with scripts/build-circuit.sh
script/Deploy.s.sol            deploys and wires everything
js/register.js                 TX 1
js/propose.js                  TX 2
js/vote.js                     TX 3, secret to submitted ballot, step by step
js/tally.js                    the read
js/demo.js                     all of it, against a local chain
```
