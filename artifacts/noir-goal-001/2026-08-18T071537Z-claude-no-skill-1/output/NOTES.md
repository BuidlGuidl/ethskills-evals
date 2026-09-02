# One member, one proposal, end to end

Membership stays public. Every member's wallet keeps its NFT, the registry stays
on the site, and enrolling to vote is a public act. What becomes unattributable
is the **ballot**: after the deadline anyone can read `3 yes / 2 no`, and nobody
— the DAO included — can say which of the 150 members produced any of those five.

Two mechanisms do the work, and one operational rule keeps them from being
undone:

1. **A membership proof that names no member.** A ballot proves "the secret
   behind one of the commitments under root R is known to me" without revealing
   which commitment. The anonymity set is every enrolled member, not just the
   ones who voted.
2. **A nullifier.** A deterministic tag derived from `(secret, proposal)`. The
   contract refuses a second ballot carrying the same tag, so one member gets
   one vote — but the tag matches no commitment, no address and no other
   proposal's tag, so it is useless for attribution.
3. **The ballot transaction is not sent by the member.** This is the rule. See
   [Who sends TX 4](#the-part-you-have-to-get-right-who-sends-tx-4).

---

## The transactions

Four transactions get one member from nothing to a counted ballot, sent by three
different wallets. Reading the tally is not a transaction at all.

| # | Call | Sender | What a chain observer learns |
|---|------|--------|------------------------------|
| 1 | `MembershipNFT.mint` | **DAO admin wallet** | this address is now a member — already public today |
| 2 | `MemberSet.enroll` | **the member's own wallet** | this member enrolled commitment `C`, and holds leaf `i` |
| 3 | `PrivateBallot.createProposal` | **a member's own wallet** | who proposed what, and the member set the vote is judged against |
| 4 | `PrivateBallot.castVote` / `castVotes` | **a submitter wallet holding no seat** | *someone* in the 150-member set voted yes (or no), and one nullifier is now spent |
| — | `PrivateBallot.result` | *no transaction* | the final tally |

Run exactly this against a throwaway chain:

```bash
./scripts/walkthrough.sh
```

---

### Before anything: the voting secret (no transaction)

The member signs a fixed message locally — `VOTING_KEY_MESSAGE` in
`scripts/lib/member.js` — and hashes the signature into a field element. That is
the voting secret. From it:

```
commitment = keccak248(secret ‖ TAG_COMMITMENT)
```

Deriving from a signature rather than a stored random file means the membership
wallet **is** the backup: any device holding it regenerates the same secret.
Ethereum signing is deterministic (RFC 6979), so the same wallet always produces
the same signature for this message.

Nothing here touches the network. No RPC call, no transaction, nothing logged.

---

### TX 1 — `MembershipNFT.mint(member)`

**Sender: the DAO admin wallet.**

The DAO's existing membership process, unchanged. `contracts/src/MembershipNFT.sol`
is a stand-in so a local chain has members on it; point `MemberSet` at the real
NFT instead by setting `MEMBERSHIP_NFT` when deploying.

**An observer learns:** this address holds seat #N. Already true today.

The stand-in is non-transferable on purpose. A transferable seat would let one
person enroll a commitment, hand the token on, and let the new holder enroll a
second one — two ballots from one seat, with nothing on chain to show it.

---

### TX 2 — `MemberSet.enroll(tokenId, commitment)`

**Sender: the member's own wallet.** It has to be: the contract checks
`membership.ownerOf(tokenId) == msg.sender`.

The commitment is appended to an on-chain Merkle tree (depth 10, 1024 seats)
and the root is updated. The tree is built **in the contract**, with keccak, so
the root is a pure function of transactions anyone can replay. There is no point
at which the DAO could slip in an extra leaf — a ballot it could then cast, or a
decoy that shrinks the real anonymity set — without it being visible.

**An observer learns:** member `0x7099…` holds seat #1 and published commitment
`0x00c75a…`, now at leaf 149. Fully attributable, and that is fine.

**They do not learn:** the secret behind the commitment, or anything about any
future ballot. The link from `C` to a ballot is exactly what the zero-knowledge
proof severs.

**Duplicate commitments are allowed on purpose.** Enrolling is a public
transaction, so anyone can copy a pending commitment out of the mempool. If the
contract rejected duplicates, a griefer could enroll a rival's commitment
against their own seat first and lock that member out permanently — the
commitment is derived from their wallet and cannot be changed. Allowing
duplicates costs nothing: a copied leaf is only spendable by whoever knows the
secret, and the nullifier still caps that secret at one ballot per proposal. The
copier has burned their own seat for nothing.

**Timing note.** Enroll well before any proposal you care about, ideally as part
of onboarding. If you are the only member to enroll in the hour before a
contested vote, that is a correlation worth avoiding — not because it reveals
your ballot, but because it draws attention. The snapshot in TX 3 makes this
mostly self-enforcing: enrolling after a proposal opens means you cannot vote on
it at all.

---

### TX 3 — `PrivateBallot.createProposal(descriptionHash, deadline)`

**Sender: a member's own wallet** (any seat holder; proposing is public).

Snapshots two things into the proposal: the current member-set root, and how
many members are behind it. Both are fixed from here on.

**An observer learns:** who proposed, the hash of the text (publish the text
itself off chain), the deadline, and that this vote will be decided by exactly
the 150 members enrolled at this block.

The snapshot cuts both ways deliberately: members who enroll later cannot vote
on this proposal, and nobody can pad or shrink the set once voting is open.

---

### Between TX 3 and TX 4 — building the ballot (no transaction)

Entirely on the member's machine:

1. Download **every** enrolled commitment (`MemberSet.leavesAt(count)`) and
   rebuild the tree locally. Asking a server "what is my Merkle path?" would
   tell that server which leaf is yours — the one fact this system exists to
   protect. Downloading all 150 leaves tells it nothing; everyone downloads the
   same list.
2. Check the locally rebuilt root equals the proposal's snapshot root. If it
   does not, **do not vote**: the tree you were served is not the tree the
   contract will check against.
3. Compute `nullifier = keccak248(secret ‖ proposalTag ‖ TAG_NULLIFIER)`.
4. Prove. ~3 seconds, 9,536-byte proof.

The circuit (`circuits/private_vote/src/main.nr`) proves three things:

- the commitment for `secret` sits under `root` (the path and the leaf index are
  private inputs — they are what would identify the member);
- `nullifier` really is this secret's tag for this proposal;
- `vote` is 0 or 1, so no ballot can be worth more than one.

Its public inputs are exactly `root`, `proposalTag`, `nullifier`, `vote`. The
secret, the path and the leaf index are not among them.

---

### TX 4 — `PrivateBallot.castVote(proposalId, choice, nullifier, proof)`

**Sender: a wallet that holds no membership NFT.** Anyone can send this; the
contract does not care who does, and that is precisely what makes the ballot
unattributable.

**An observer learns:**

- some member of the 150-member snapshot voted YES;
- nullifier `0x00ebb9…` is now spent for proposal #0;
- the sender paid ~946k gas.

**They cannot learn:** which of the 150. The nullifier is a hash of a secret
nobody else knows; it matches no commitment, no address, and no nullifier this
member may have produced on any other proposal. `proposalTag` is
`keccak248(ballotContract ‖ proposalId)`, so tags — and therefore nullifiers —
never collide across proposals or across deployments.

The choice is a public input bound into the proof, so a relayer holding someone
else's ballot can drop it, but cannot flip it, retarget it at another proposal,
or swap its nullifier. Any of those invalidates the proof.

`castVotes` takes a batch. It is the better path: one transaction carrying
ballots collected from many members removes the timing correlation that a drip
of single-ballot transactions leaks, and makes it obvious the sender is not the
voter. Ballots whose nullifier is already spent are skipped rather than
reverting the batch, so front-running one ballot out of a batch cannot grief the
rest.

---

### Reading the tally — no transaction

`result(proposalId)` returns `(yes, no, passed)` to anyone, once the deadline has
passed. Before then it reverts, so a half-finished vote is never presented as a
result.

Be clear-eyed about this one: it is presentation, not secrecy. Each ballot
increments a counter and emits `VoteCast`, so the running count is derivable
from chain state and events at any time. Concealing it would need encrypted
ballots and a threshold decryption committee — people who could collude to
decrypt individual ballots, which is the thing you asked to rule out.

---

## The part you have to get right: who sends TX 4

A member who sends their own ballot from their own wallet has published exactly
what the proof hides. No contract can prevent that; `scripts/vote.js` refuses
when `SUBMITTER_KEY` is the membership wallet, and warns when the submitter
holds a seat, but the discipline has to live in the client.

Three workable arrangements, best first:

1. **A batching relayer.** Members hand their ballots to a collector over Tor
   or a mixnet; it submits them in one `castVotes` transaction near the
   deadline. A DAO-run relayer is fine — it holds proofs, and a proof reveals
   nothing about which leaf produced it. What a relayer does see is *network*
   metadata (an IP, a timestamp), which is why the transport matters more than
   who runs it.
2. **A fresh wallet per member.** Works, but the gas has to come from somewhere.
   Funding it from the membership wallet recreates the link on chain. Fund it
   from an exchange withdrawal, a faucet, or a different chain.
3. **Account abstraction with a public paymaster.** The ballot arrives as a user
   operation the member never pays for directly.

Whichever you pick, publish it as the official client and make it the default.
Privacy that depends on each member improvising is privacy that a handful of
members will get wrong, and every member who gets it wrong shrinks the anonymity
set for everyone else.

---

## What is still visible

An honest list, because these are the things people get surprised by:

- **The running tally.** Counts move as ballots land. Attribution is protected;
  arithmetic is not.
- **Turnout.** `5 of 150 voted` is public. So is the fact that 145 did not.
- **Timing.** When each ballot arrived. Batched submission is what blunts this.
- **Arithmetic on disclosures.** If 149 members publicly announce how they
  voted, the 150th is determined. No cryptography fixes that.
- **Network metadata.** The RPC endpoint or relayer you submit through sees your
  IP. Use Tor or a relayer you did not have to identify yourself to.
- **Front-running.** Anyone can copy a pending ballot from the mempool and
  submit it first. The vote still counts, identically — the copier cannot change
  it — but the member's own transaction then reverts with
  `NullifierAlreadySpent`. Another reason to batch.
- **Membership itself.** Who holds a seat and who enrolled a commitment are
  public. That is your stated situation, and it helps: a large, public,
  well-known member list is a large anonymity set.

## Limits and trade-offs we chose

- **A lost secret is a lost vote, permanently.** Enrollment is one commitment
  per seat, forever. Letting a member replace a commitment would leave the old
  leaf in the tree with its nullifiers still spendable — two ballots from one
  seat. Deriving the secret from a wallet signature is the mitigation: the
  wallet is the backup. Recovering from a genuinely lost *wallet* means issuing
  a new seat and deploying a fresh `MemberSet`.
- **No revocation.** A commitment cannot be removed from an append-only tree. If
  a secret is compromised, the holder can vote as that member until the DAO
  moves to a new `MemberSet`.
- **Not receipt-free.** A member can prove how they voted by revealing their
  secret and recomputing the nullifier. Vote *buying* is therefore not prevented,
  only vote *surveillance*. Receipt-freeness needs a different scheme.
- **Any member can open unlimited proposals.** There is no deposit, rate limit
  or quorum gate on `createProposal` — add whichever your governance already
  uses. It does not affect ballot privacy, but it is a spam surface.
- **The admin can still stuff the roll.** Minting seats to itself would let the
  DAO cast extra ballots. That is an integrity problem, not a privacy one, and
  it is visible on chain — membership is public. Constrain it the way you
  already constrain minting.
- **Universal trusted setup.** UltraHonk uses KZG over BN254 and inherits the
  existing Aztec/perpetual-powers-of-tau SRS. No per-circuit ceremony.
- **1024 seats.** `TREE_DEPTH = 10`. Growing past it means a new circuit, a new
  verifier and a new deployment. The constant appears in three places, all
  cross-checked by tests: `main.nr`, `MemberSet.sol`, `scripts/lib/tree.js`.

## Why keccak and not Poseidon

Poseidon would make a much smaller circuit. But the member tree has to be built
**on chain** for the root to be trustless, and Poseidon in Solidity means
importing a large generated library and betting that its constants match Noir's.
Truncated keccak (`keccak256`, low 248 bits, so the digest is always a valid
BN254 field element) is native on both sides: `Keccak248.sol` and `hash.nr` are
each about thirty lines, and a Foundry test pins the domain tags against the
literals the circuit uses. The cost is a 220k-gate circuit and ~3s proving,
which for a governance vote is nothing.

## Numbers

| | |
|---|---|
| Circuit size | 220,044 gates |
| Proving time | ~3 s (bb 5.1.0, in process, native backend) |
| Proof size | 9,536 bytes |
| `enroll` | ~168k gas |
| `createProposal` | ~127k gas |
| `castVote` | ~946k gas (of which ~920k is proof verification) |
| `castVotes` × 5 | ~4.60M gas (~919k per ballot) |
| `HonkVerifier` runtime size | 16,973 B (under the 24,576 B limit) |
| Anonymity set | every enrolled member under the proposal's root — 150 |

Verification dominates, so this wants an L2. The generated verifier is the
`--optimized` variant, which is 2.3× cheaper than the default (~3.2M gas).

## Running it

```bash
./scripts/build-circuit.sh     # compile the circuit, regenerate HonkVerifier.sol
node scripts/make-fixture.js   # refresh the real-proof fixture forge test uses
cd contracts && forge test     # 29 tests, including a real proof through the verifier
cd circuits/private_vote && nargo test

./scripts/walkthrough.sh       # the four transactions above, on a throwaway chain
./scripts/e2e.sh               # 150 members, 5 relayed ballots, tally
```

Or drive one member by hand against a chain you already have:

```bash
anvil &
./scripts/deploy.sh
MEMBERS=0x70997970C51812dc3A010C7d01b50e0d17dc79C8 node scripts/mint.js
MEMBER_KEY=0x59c6…                                 node scripts/enroll.js
MEMBER_KEY=0x59c6… TEXT="Fund the grants program"  node scripts/propose.js
MEMBER_KEY=0x59c6… SUBMITTER_KEY=0x5de4… VOTE=yes  node scripts/vote.js
PROPOSAL_ID=0                                      node scripts/tally.js
```

`MEMBER_KEY` signs nothing on chain in that last step — it only re-derives the
secret locally. `SUBMITTER_KEY` sends the transaction.
