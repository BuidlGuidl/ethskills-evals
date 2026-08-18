# Anonymous DAO voting — how one member votes on one proposal

The DAO has 150 members. Membership is public: every member's wallet holds a membership NFT and
the registry is on the DAO's website. The requirement is that nobody — including the DAO — can
tell how any individual member voted.

The design that gets there: every member publicly deposits a **commitment** (a Poseidon hash of
secrets only they know) into an onchain Merkle tree. To vote, a member proves in zero knowledge
that they know the secrets behind *some* leaf of that tree, without saying which. The proof
carries a **nullifier hash** derived from their secrets *and* the proposal id, which lets the
contract reject a second ballot from the same member on that proposal while telling nobody which
member it belongs to. The proof is submitted by a wallet that has nothing to do with the member.

Membership being public is not a problem here — it is the asset. The anonymity set is the whole
membership, which is the largest set it could possibly be.

---

## The five transactions, and what each one leaks

Walking one member (call them M, holding membership NFT #8) through one proposal.

### TX 0 — Deploy the system

**Sender:** the DAO's deployer wallet. One-time.
**Call:** `forge script script/Deploy.s.sol` — deploys `MembershipNFT`, `HonkVerifier`,
`MemberRegistry(nft)`, `AnonVoting(verifier, registry)`.

**An observer learns:** the contract addresses and the wiring between them.

The wiring is worth dwelling on, because it is what makes "including us" true. Every reference is
`immutable`: `AnonVoting.verifier`, `AnonVoting.registry`, `MemberRegistry.membershipNFT`. There
is no owner, no setter, no upgrade proxy, no pause. The DAO cannot later swap in a verifier that
accepts forged proofs, cannot rewrite the tree, and holds no key that could decrypt anything —
because nothing is encrypted *to* anyone. The privacy comes from information that never existed
onchain, not from information someone is trusted to keep.

### TX 1 — M joins the vote

**Sender: M's own wallet — the one holding membership NFT #8.** Openly attributable, on purpose.
**Call:** `MemberRegistry.register(tokenId: 8, commitment)`

Beforehand, entirely offline, M derives their identity (`scripts/lib/identity.mjs`):

```
seed              = keccak256( sign(IDENTITY_MESSAGE) )     # M's wallet signature, never sent
identityNullifier = Poseidon(seed, 1)
identitySecret    = Poseidon(seed, 2)
commitment        = Poseidon(1, Poseidon(identityNullifier, identitySecret))
```

The contract checks `nft.ownerOf(8) == msg.sender` and that token 8 has never registered before,
then inserts the commitment as a leaf in a LeanIMT and emits
`MemberRegistered(tokenId, commitment, leafIndex, newRoot)`.

**An observer learns:** that the holder of NFT #8 is now in the anonymity set, and a 32-byte
commitment. That is all. The commitment is a Poseidon hash of secrets with ~254 bits of entropy;
it cannot be inverted, and it cannot be connected to anything M does later.

Two things follow from this being a public, per-member transaction:

- **Everyone should register, including members who intend to abstain or to vote with the
  majority.** A member who never registers is not hiding — they have shrunk the crowd for everyone
  else. Registration is a one-time act that says nothing about how you will vote.
- **Register well before proposals open**, not in the same hour you vote. Registering minutes
  before a ballot lands is a timing signal. Do it once, at the start, for everybody.

Registration is keyed on `tokenId`, not on the caller, so selling the NFT does not mint a second
commitment. The flip side, stated plainly: a member who sells their NFT keeps the ability to vote
until the DAO rotates the tree. If that matters, add a governance-controlled `remove` (LeanIMT
supports it) and treat the resulting root change as a new snapshot.

### TX 2 — Someone opens a proposal

**Sender:** any member's ordinary wallet. Also openly attributable; there is nothing to hide about
proposing.
**Call:** `AnonVoting.createProposal(descriptionHash, deadline)`

The contract snapshots `registry.root()` into the proposal and emits `ProposalCreated`.

**An observer learns:** who proposed, the description hash, the deadline, and the Merkle root that
fixes this proposal's electorate.

Pinning the root at creation does two jobs. It makes the anonymity set for this proposal fixed and
auditable — anyone can replay the registration log up to this block and confirm the root covers
exactly 150 members. And it stops a late-joining commitment from voting on a proposal that was
already open. The cost, which is the intended policy: **a member who registers after this
transaction cannot vote on this proposal.** They can vote on the next one.

### TX 3 — M votes

This is the transaction the whole design exists to protect, and **M's wallet does not send it.**

First, offline — no RPC call that reveals intent, no signature, nothing that touches M's wallet
(`scripts/vote.mjs` stages 1–5):

1. M re-derives their identity from their seed.
2. M reads the proposal's snapshot root and replays `MemberRegistered` logs **up to the
   proposal's creation block** to rebuild the exact tree the contract pinned, then generates a
   Merkle witness for their own leaf. The contract never hands out witness paths; everyone
   reconstructs the tree themselves, and because the offchain Poseidon is bit-identical to the
   contract's, everyone gets the same root.
3. M computes `nullifierHash = Poseidon(Poseidon(2, proposalId), identityNullifier)`.
4. M generates the Honk proof (~0.7 s on a laptop, 8,384 bytes).

The proof's public inputs are exactly four values, in this order:
`[merkleRoot, proposalId, nullifierHash, vote]`. Everything identifying — the identity secrets and
the Merkle path that says *which* leaf — stays private.

Then M hands `{proposalId, proof, nullifierHash, support}` to whoever will submit it. Two ways:

**Sender (default): a relayer.** M sends the blob over any channel that does not reveal their IP
and never appears onchain at all. `castVote` does not read `msg.sender` and nothing in the proof
binds to the submitter, so a relayer cannot be extorted into a particular identity — and, more
usefully, M never needs gas, so there is no funding trail to follow.

**Sender (alternative): a burner wallet** M controls, funded out of band. This only works if the
funding did not come from anything traceable to M. `scripts/vote.mjs --via burner` funds the
burner from the anvil faucet and prints a warning saying so, because on a real chain **that
funding transfer is the whole attack**: whoever funded the burner is trivially linked to the
ballot it casts. Use an exchange withdrawal, a pre-existing unrelated address, or a paymaster.

**Call:** `AnonVoting.castVote(proposalId, proof, nullifierHash, support)`

The contract checks the deadline, checks `support <= 1`, checks the nullifier is unspent,
rebuilds the four public inputs from the proposal's pinned root and the caller's arguments, and
calls `HonkVerifier.verify`. Only after that does it mark the nullifier and bump a counter.

**An observer learns:**

| Visible | What it tells them |
|---|---|
| the sender (relayer or burner) | nothing about M — the relayer submits for everyone |
| `nullifierHash` | an opaque 32-byte value. Unlinkable to any commitment: it is `Poseidon` of a secret they do not have. Different on every proposal, so ballots cannot even be linked to *each other* across proposals |
| `support` — yes or no | **the ballot value is public.** Which is fine: it is not attached to anyone |
| the running tally moved by one | that one of the 150 registered members voted this way |
| gas used (~2.57M) | nothing — proof verification costs the same for every member |

What they cannot learn, and what no amount of chain analysis recovers: **which of the 150 members
cast it.** Every registered member could have produced a byte-identical transaction.

The DAO is in exactly the same position as any other observer. It has no key that helps.

### TX 4 — there is no TX 4

**The tally needs no transaction and no trusted tallier.** `AnonVoting.result(proposalId)` is a
view call anyone can make once the deadline passes, returning `(yesVotes, noVotes, passed)`. There
is nothing to decrypt, no ceremony, no coordinator who could stall or lie: the counters were
incremented in the open, one per verified anonymous proof.

---

## What this hides, and what it does not

**Hidden:** the mapping from member to ballot. This is the requirement, and it holds against the
DAO itself.

**Not hidden, by design:**

- **Who is in the electorate.** Registration is public. Given that membership is already public on
  the DAO's website, this costs nothing.
- **Each ballot's value, and the running tally.** Ballots are counted in plaintext, so watching
  the chain during voting shows each `yes`/`no` as it lands and a running total. This leaks no
  identity — an unattributed `yes` is just an unattributed `yes` — but it does mean the outcome is
  visible before the deadline, which can influence later voters. If the DAO wants the tally sealed
  until the deadline too, that is a different and much heavier system (MACI-style encrypted
  ballots with a coordinator who decrypts at the end, which reintroduces a trusted party for
  *tally correctness* even while preserving voter privacy). Out of scope here, and worth being
  explicit that it was a choice.
- **Turnout.** The number of ballots is public.

**Residual risks that live outside the cryptography.** These are where a 150-member DAO actually
gets deanonymised, and they are operational, not mathematical:

1. **Timing correlation.** If M is the only person awake at 03:00 and one ballot lands at 03:00,
   the proof did its job and the clock undid it. Mitigation: relayers that batch and delay, and a
   voting window long enough (days, not hours) that ballots pile up.
2. **The gas funding trail.** Covered above. This is the single most common way this pattern is
   broken in practice. The relayer path avoids it entirely, which is why it is the default.
3. **Network-level identity.** Submitting through your usual RPC provider tells that provider who
   you are. The relayer sees your IP unless you reach it over Tor or a mixnet. The relayer also
   sees your ballot value — it cannot forge or alter it (see below), but it can log "this IP voted
   yes". Use a relayer you would be comfortable having that log, or route around it.
4. **A guessable seed.** If M's identity seed is low-entropy, anyone who guesses it recomputes M's
   nullifier hash, matches it against the chain, and reads M's vote. `demoSeed` in
   `scripts/demo-members.mjs` is deliberately guessable and is for the local demo only; real
   members must use `identityFromWallet` (signature-derived) or a random 32-byte seed. This is the
   only way the DAO could break the scheme, and it requires the member to have been careless.
5. **Small effective anonymity sets.** 150 registered members gives 1-in-150. If only 12 members
   ever register, it is 1-in-12. Push registration hard and early.
6. **A near-unanimous vote.** If the tally is 149–1, the lone dissenter is anonymous but the
   *existence* of a dissenter is not. No voting system fixes this; it is information in the result
   itself.

**Attacks the contract does stop** (each has a test in `contracts/test/AnonVoting.t.sol`):

- **A hostile relayer flipping your ballot.** `vote` is a bound public input of the proof, so
  changing `support` in flight invalidates the proof. A relayer can drop your ballot — censorship
  is always available to whoever holds it — but cannot change it. Detect censorship by watching
  for your nullifier hash and re-submitting elsewhere.
- **Voting twice.** The same identity yields the same nullifier hash on the same proposal, whether
  they vote yes then no or yes then yes. Second one reverts.
- **Replaying a ballot onto another proposal.** `proposalId` is a public input, and the nullifier
  is domain-separated by it.
- **Tampering with the nullifier** to vote again. It is a public input; the proof breaks.
- **Voting without being a member**, or after the deadline, or with `support = 2`.
- **A latecomer voting on an already-open proposal** — the snapshot root does not move.
- **Buying a registered NFT to get a second commitment** — registration is keyed on token id.

A note on proof replay: because nothing binds the proof to a submitter, a mempool watcher can copy
M's pending transaction and land it first. The effect is nil — the same nullifier and the same
ballot get recorded, just paid for by someone else. It is not a griefing vector worth defending
against, and defending against it would mean binding the proof to a submitter address, which is
precisely what we do not want.

---

## Running it

```bash
git submodule update --init --recursive   # forge-std, openzeppelin, zk-kit.solidity
npm install
npm run circuit     # nargo compile + nargo test + bb write_vk + write_solidity_verifier
npm run fixture     # real proofs for the Foundry tests
npm test            # 16 tests, incl. real proofs through the real HonkVerifier
npm run demo        # anvil + deploy + 150 registrations + proposal + votes + tally
```

`npm run demo` is the end-to-end story above, on a local chain. To drive the pieces by hand
against an already-running anvil:

```bash
npm run deploy
npm run register                                        # all 150 members
npm run propose -- "Fund the grants round" 3600
npm run vote -- --member 7 --proposal 1 --support yes
npm run vote -- --member 42 --proposal 1 --support no --via burner
npm run tally -- 1
```

## Layout

```
circuits/anon_vote/src/main.nr    the circuit: membership + nullifier + ballot range
circuits/build.sh                 compile -> vk -> HonkVerifier.sol -> contracts/src/verifiers/
contracts/src/MemberRegistry.sol  NFT-gated commitment tree (LeanIMT + PoseidonT3)
contracts/src/AnonVoting.sol      proposals, proof verification, nullifiers, tally
contracts/src/verifiers/          generated by circuits/build.sh, do not hand-edit
contracts/src/vendor/             PoseidonT3, vendored (upstream repo is gone)
contracts/script/Deploy.s.sol     deploy + wire + mint 150 NFTs
scripts/lib/identity.mjs          secret -> commitment / nullifier hash
scripts/lib/tree.mjs              offchain mirror rebuilt from MemberRegistered logs
scripts/lib/prove.mjs             NoirJS + bb.js proof generation
scripts/vote.mjs                  one member: secret -> proof -> submitted ballot
```

## Two things that will break this if you change them

**Poseidon parity.** The circuit (`poseidon::poseidon::bn254::hash_2`), the offchain mirror
(`poseidon-lite`'s `poseidon2`), and the contract (`PoseidonT3.hash`) must produce identical
output. If they drift, nothing errors usefully — proofs just stop verifying. The same test vector
is pinned in all three places: `test_poseidon_parity_with_js` in the circuit,
`HashParityTest` in Solidity, and `test_RegistrySnapshotMatchesOffchainTree` which asserts the
onchain root equals the offchain one over all 150 leaves.

**Proof settings.** `circuits/build.sh` uses `bb --verifier_target evm` and
`scripts/lib/prove.mjs` uses `{ verifierTarget: "evm" }`. These must match. Note that the older
pairing of `--oracle_hash keccak` with bb.js `{ keccak: true }` is *not* equivalent on bb 5.x —
the CLI flag leaves ZK Honk on while the bb.js flag turns it off, and you get a verifier expecting
8384-byte proofs fed 7424-byte ones. Symptom: `ProofLengthWrongWithLogN`.

Public input order is load-bearing in four places at once — the circuit's `pub` parameters,
`proof.publicInputs` from NoirJS, the array `AnonVoting.castVote` builds, and the verifier. It is
`[merkleRoot, proposalId, nullifierHash, vote]` everywhere.
