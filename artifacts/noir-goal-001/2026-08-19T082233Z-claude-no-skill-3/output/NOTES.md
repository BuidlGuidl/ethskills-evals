# Private DAO voting — how one member votes on one proposal

Membership stays public. Ballots do not.

The system is four things:

| what | where |
|---|---|
| the ballot circuit | `circuits/vote/src/main.nr` (+ `hash.nr`, `merkle.nr`) |
| the anonymity set | `src/MembershipRegistry.sol` |
| proposals, ballots, tally | `src/PrivateBallot.sol` |
| the generated verifier | `src/verifiers/HonkVerifier.sol` (from `bb`, do not hand-edit) |
| deploy + wiring | `script/Deploy.s.sol`, `scripts/deploy-local.sh` |
| a member's client | `js/register.js`, `js/vote.js`, `js/tally.js`, `js/core/*` |

One hash is used everywhere — `keccak256(be32(a) ‖ be32(b)) >> 8` — implemented three
times and kept in step by the tests: `hash.nr`, `src/libraries/Hash.sol`, `js/core/hash.js`.
The `>> 8` keeps every output below 2^248, so the same value is a valid Merkle node in
Solidity and a valid `Field` in Noir. Choosing keccak over Poseidon costs gates in the
circuit (~19k per hash, 187k total) and buys the thing that matters here: the membership
tree is maintained **on-chain**, in plain Solidity, for a few thousand gas per level. No
operator publishes the root, so no operator can quietly swap the electorate.

## The rule everything else hangs on

**A member's own wallet never sends their ballot.** A proof that hides which of the 150
members you are is worth nothing if the transaction that carries it is signed by your
address. So the ballot is handed to a *relayer* — any other address — which pays the gas
and sends the transaction. `js/vote.js` refuses to run if the two wallets are the same.

The proof binds the submitter's address, so a relayer cannot alter the ballot it was
handed, and nobody can lift a ballot out of the mempool and re-send it as their own.
(Pass `--open` to bind `address(0)` instead, which lets *anyone* submit it — useful if
you would rather broadcast ballots to a public channel than trust one relayer to send.)

## The flow, one member, one proposal

### Step 1 — join the anonymity set (once, ever)

The member picks a secret. In `js/core/identity.js` it is derived from a signature over a
fixed message, so there is nothing to back up; a member who prefers no link at all to
their wallet key can use a random secret kept offline instead. Either way the secret
never leaves their machine.

    commitment = hash(secret, 0)

**tx 1 — `MembershipRegistry.register(tokenId, commitment)`**
sent by **the member's own public wallet**, ~157k gas.

The contract checks the caller owns that membership NFT and that the NFT has not already
been used (one leaf per NFT, not per wallet, so moving the NFT to a fresh wallet does not
buy a second vote), then appends the leaf to the on-chain Merkle tree.

A chain observer learns: *"the wallet holding membership NFT #7 put leaf `0x0046…` at
index 3, the root is now `0x0042…`, there are now 150 leaves."* That link is permanent —
and harmless, because nothing a ballot ever publishes points back at a leaf.

### Step 2 — open a proposal

**tx 2 — `PrivateBallot.createProposal(descriptionHash, votingPeriod)`**
sent by **any member's public wallet**, ~128k gas.

It records the description hash, the deadline, and — importantly — the *current
membership root*. The electorate is frozen at proposal time, so nobody can join a
running vote and nobody can be pushed out of one.

An observer learns: who proposed, what the deadline is, and how many members are in the
snapshot. Nothing about anyone's opinion.

### Step 3 — vote (no transaction from the member)

All of this happens on the member's own machine, offline apart from two `eth_call`s:

1. Read the proposal's snapshot root and the full leaf list
   (`registry.getCommitments()`). The whole list, not just their own leaf — asking a
   server for "my Merkle path" would tell that server which leaf is theirs.
2. Rebuild the tree, find their leaf, take the path. Since leaves are append-only, the
   snapshot is a prefix of today's list; `js/core/merkle.js` walks prefixes back until the
   root matches.
3. Compute the nullifier:

       scope     = hash(hash(ballotContract, chainId), proposalId)
       nullifier = hash(secret, scope)

   Deterministic for this member on this proposal — which is what makes a second ballot
   impossible — and a fresh, unrelated-looking value on every other proposal, which is
   what stops ballots being linked to each other across proposals. Binding the contract
   and chain into the scope stops a ballot being replayed onto a redeployment of the
   contract or onto the same DAO on another chain.
4. Prove. Public inputs: `membershipRoot`, `proposalScope`, `nullifier`, `support`,
   `submitter`. Private witness: `secret`, `leafIndex`, `siblings`. ~2.3 s on a laptop,
   9,536-byte proof.
5. Hand proof + public inputs to a relayer (an HTTP POST, a gossip channel, a friend).

**tx 3 — `PrivateBallot.castVote(proposalId, nullifier, support, submitter, proof)`**
sent by **the relayer**, ~2.78M gas.

The contract checks the deadline, checks `msg.sender` is the bound submitter, checks the
nullifier is unspent, and verifies the proof against the proposal's frozen root. Then it
marks the nullifier spent and bumps one of two counters.

An observer learns: *"one of the 150 members in this snapshot voted yes"*, plus a
32-byte nullifier that matches no leaf, no wallet and no other proposal's nullifier, plus
the fact that this relayer paid for it. Which of the 150 it was is not in the
transaction, not in the logs, and not recoverable from the proof.

### Step 4 — the tally

`PrivateBallot.tally(proposalId)` — **a view call, no transaction, no key**. It reverts
until the deadline has passed so there is one canonical final result. That gate is a
convention, not a privacy boundary: ballots are public as they land, so anyone can keep a
running count (see below).

## Every transaction, at a glance

| # | call | sender | what the chain sees | what it does not see |
|---|---|---|---|---|
| 0 | deploy | DAO deployer | the contracts and their wiring | — |
| 1 | `register` | **the member**, in the open | which NFT joined, which leaf, the new root | anything about any vote |
| 2 | `createProposal` | **a member**, in the open | proposer, deadline, snapshot root, electorate size | — |
| 3 | `castVote` | **a relayer — never the voter** | a nullifier, yes/no, the proof, the relayer | which member, which leaf, how they voted on any other proposal |
| — | `tally` | nobody (view call) | the totals | — |

## Why no one can attribute a ballot

Four independent things have to hold, and each is checked somewhere in the repo:

1. **The proof reveals nothing.** UltraHonk with ZK enabled (`bb … -t evm`); `secret`,
   `leafIndex` and `siblings` are witness-only. There is no per-circuit trusted setup —
   the SRS is the universal one.
2. **The nullifier reveals nothing.** It is `hash(secret, scope)`, and the leaf is
   `hash(secret, 0)`. Going from one to the other means inverting keccak. This is the
   assumption that puts a hard requirement on the secret: it must be full-entropy. A
   guessable secret can be brute-forced against the *public* leaf list and would unmask
   every ballot that member ever cast.
3. **The sender reveals nothing.** The relayer sends it, and the proof pins the ballot to
   that relayer so it cannot be rewritten in flight.
4. **The set is big.** The anonymity set is every leaf in the proposal's snapshot — up to
   the whole 150-member DAO. It is not reduced by voting order or timing: every leaf is
   equally consistent with every ballot.

Nobody is trusted for any of the four. There is no coordinator, no tally authority, no
decryption key — which is the point of the requirement "including us". Nothing exists
that could decrypt a ballot even under subpoena, because nothing about a ballot is
encrypted to anybody.

## What is deliberately public

Being straight about this, because it is easy to over-claim:

- **Membership and the leaf list.** By design; membership is public anyway.
- **Turnout.** How many ballots landed, and when.
- **Each ballot's yes/no, as it lands.** `support` is in the calldata; a watcher can keep
  a running count and see the sequence of choices. What they cannot do is attach any of
  them to a member. If you also need the *sequence* hidden, that needs a homomorphic
  tally with threshold decryption (a keyholder set) or a MACI-style coordinator — both
  reintroduce someone who could, in principle, see individual ballots. That trade was not
  worth making against a requirement that says *including us*.
- **That a given member voted at all** is hidden — but the reverse is not: if 150 of 150
  ballots land, everyone voted, and if the result is unanimous everyone's vote is known.
  That is inherent to any secret ballot, not to this design.

## Where privacy can still be lost operationally

- **A member sends their own ballot.** Total deanonymisation, and the contract cannot
  detect it — it is `msg.sender` paying gas from a known member wallet. The client
  refuses to do it; the DAO's docs must say it too.
- **A single DAO-run relayer** learns, at the network level, who handed it which ballot.
  It cannot forge or alter ballots, but it can log IPs and it can censor. Use several
  independent relayers, let members relay for each other, or use `--open` and broadcast.
- **Timing correlation off-chain.** A member's laptop talking to the relayer at 14:03 and
  a ballot landing at 14:03. Tor or a batching relayer; not something the chain can fix.
- **Tiny snapshots.** A proposal created when only three members have registered has an
  anonymity set of three. Let registrations accumulate before contested votes; the
  electorate size is printed by `js/propose.js` and is on-chain.
- **A leaked wallet key**, if the secret was derived from a signature: whoever gets the
  key can recompute every nullifier that member ever published and read their past votes
  retroactively. Use `randomSecret()` and offline storage if that is in the threat model.

## Known limitations / what I would do next

- **No member removal.** A leaf stays in the tree even if the NFT is sold; the buyer
  cannot register (the token is used) and the seller keeps voting power in future
  proposals. Fixable cheaply because the hash is keccak: a governance-gated
  `remove(leafIndex)` that rebuilds the 256-leaf tree on-chain costs on the order of
  500k gas. Deliberately out of the core.
- **256 members max** (`TREE_DEPTH = 8`). Raising it means changing the constant in three
  places (`merkle.nr`, `MembershipRegistry.sol`, `js/core/merkle.js`) and regenerating the
  verifier; each extra level adds ~19k gates.
- **2.78M gas per ballot** — that is 9.5 KB of proof calldata plus Honk verification.
  Fine on an L2, painful on L1 mainnet for 150 ballots. The `--optimized` verifier and
  proof batching (one aggregated proof for many ballots) are the obvious next steps.
- **Relayers need funding and are a censorship point.** A relayer that is paid per ballot
  (fee in the ballot, checked in-circuit) removes the goodwill assumption.
- **Not audited.** The circuit, the tree and the contracts are small and covered by tests,
  but this is a working core, not a reviewed system.

## Costs and sizes

| | |
|---|---|
| circuit | 187k gates, 2^18 rows, 5 public inputs |
| proving | ~2.3 s, ~350 MB, on a laptop |
| proof | 9,536 bytes |
| `register` | ~157k gas |
| `createProposal` | ~128k gas |
| `castVote` | ~2.78M gas |

## Running it

    ./scripts/build-circuit.sh      # nargo test + compile, regenerate verifier, forge test
    npm install
    anvil                           # separate terminal
    ./scripts/demo-local.sh         # deploy, 5 members join, a proposal, 2 ballots, the tally

or by hand, after `./scripts/deploy-local.sh`:

    node js/register.js --member-key 0x…
    node js/propose.js  --text "Fund the grants round?" --hours 24
    node js/vote.js     --proposal 1 --support yes --member-key 0x… --relayer-key 0x…
    node js/tally.js    --proposal 1 --warp
