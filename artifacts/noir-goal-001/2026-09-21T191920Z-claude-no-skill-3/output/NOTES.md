# Anonymous DAO voting: how it works

The goal: members vote yes/no on many proposals, at most one vote per member per
proposal, and the tally is public after the deadline. **Nobody, including the DAO
team, can tell how any individual member voted.**

The approach is a Semaphore-style design:

- Each member publishes a commitment to a secret **once**, from their NFT wallet.
- For each vote, the member proves in zero knowledge that they know the secret
  behind *some* registered commitment.
- A per-proposal **nullifier** stops double voting. The nullifier cannot be linked
  to the commitment or to the same member's nullifiers on other proposals.
- The vote transaction is sent by a **relayer**, never by the member's wallet.

## Layout

| Path | What |
|---|---|
| `circuits/vote/src/main.nr` | The Noir circuit: Merkle membership + nullifier + binary vote |
| `contracts/src/VoterRegistry.sol` | Onchain Poseidon Merkle tree with one leaf per membership NFT (register, rotate, evict) |
| `contracts/src/AnonymousVoting.sol` | Proposals (root snapshot + deadline), `castVote`, nullifier set, tally |
| `contracts/src/HonkVerifier.sol` | UltraHonk **ZK** verifier, generated from the circuit by `scripts/build-circuit.sh` |
| `contracts/src/PoseidonT3.sol` | Vendored circomlib-compatible Poseidon (the same hash as the circuit and `poseidon-lite`) |
| `contracts/src/MembershipNFT.sol` | Stand-in NFT for local runs. In production, point the deploy script at your NFT |
| `contracts/script/Deploy.s.sol` | Deploys and wires NFT → Registry → Voting ← Verifier, and writes `deployments/<chainId>.json` |
| `scripts/register.mjs` | Member joins: derives the secret, then registers the commitment |
| `scripts/vote.mjs` | Member votes: secret → Merkle path → local proof → relayer |
| `scripts/relayer.mjs` | Minimal HTTP relayer that anyone can run |
| `scripts/proposal.mjs` | Create a proposal; read the tally |
| `scripts/demo-local.sh` | The whole flow on a throwaway anvil chain |

Tool versions: nargo 1.0.0-rc.2, bb 5.2.0, `@noir-lang/noir_js` 1.0.0-rc.2,
`@aztec/bb.js` 5.2.0, and Foundry. The JS packages are pinned exactly because their
versions must match the CLIs.

```sh
npm install
npm test                 # nargo test + forge test
npm run demo             # anvil on :8546, relayer on :8787; ~30 s end to end
```

On a real network:

```sh
cd contracts && NFT_ADDRESS=0x... MIN_ANONYMITY_SET=100 \
  forge script script/Deploy.s.sol --rpc-url $RPC --private-key $KEY --broadcast
```

If you change the circuit, you must run `scripts/build-circuit.sh` and redeploy,
because the verifier embeds the verification key.

## The cryptography in one paragraph

A member's secret is `s`. Their leaf is `C = Poseidon(s)`. For proposal `p`, the
contract computes `scope = keccak(chainid, votingContract, p) mod r`. The circuit
takes `root`, `scope`, `vote` and `nullifier` as public inputs, and `s` plus a Merkle
path as private inputs. It proves:

- `Poseidon(s)` is a leaf under `root`;
- `nullifier = Poseidon(s, scope)`;
- `vote ∈ {0,1}`.

The proof is an UltraHonk proof with zero knowledge enabled (`-t evm` /
`verifierTarget: "evm"`), so it reveals nothing beyond those four public values.

`root` is the registry root **snapshotted when the proposal was created**, so every
voter on a proposal proves against the same root and hides among the same
electorate. `vote` and `nullifier` are bound by the proof, so a relayer can't change
them. The contract rejects a nullifier it has already seen, and any nullifier ≥ the
field modulus, which would otherwise let `n` and `n + r` count as two votes.

## End-to-end: one member, one proposal

Cast: **Alice** holds membership NFT #7 in wallet `W_alice`. **Relayer** is any
relayer wallet `W_relay`. Ideally it is not run by the DAO team, and several should
exist. **Proposer** is any NFT holder.

### 0. Deployment (once, by the DAO)

- **Transactions:** deploy PoseidonT3, VoterRegistry(nft), HonkVerifier, and
  AnonymousVoting(registry, verifier, minAnonymitySet).
- **Sender:** the deployer wallet.
- **What an observer learns:** the contract addresses and the circuit (via the
  verifier's VK).
- **Admin powers:** there are no admin functions, owner or upgrade path in the
  registry or voting contracts. The deployer has no special power after deployment.

### 1. Joining the vote: `VoterRegistry.register(7, C)`, once per member, not per proposal

**Offchain first:** Alice's client asks `W_alice` to sign a fixed message
(`"DAO anonymous voting identity / chainId / registry / keyVersion"`). It sets
`s = keccak(signature) mod r` and `C = Poseidon(s)`.

- This is only a signature. No transaction happens, and nothing leaves her machine.
- Alice can re-derive `s` from her wallet at any time, so there is no separate
  backup. Alternatively, she can supply `IDENTITY_SECRET` directly.

**Transaction:** `register(7, C)`.

- **Sender:** `W_alice`, the NFT holder. The contract requires
  `nft.ownerOf(7) == msg.sender`.
- **What an observer learns:**
  - "the holder of NFT #7 (`W_alice`) registered identity commitment `C` at leaf `i`";
  - the new registry root;
  - that the active-member count went up.
- **What the observer does not learn:** anything about any vote. `C` is a hash of
  a secret, and nothing Alice later does onchain references `C` or `i`.

This link between wallet and commitment is public on purpose. It lets the DAO
check that the electorate is exactly the NFT holders.

Other cases:

- **Key rotation:** Alice calls `register(7, C')` again with `keyVersion+1`. This
  replaces her leaf in place.
- **Selling the NFT:** anyone may call `evict(7)`, which zeroes the old leaf once the
  registrant no longer holds the token. The new holder then registers their own
  commitment.

The tree never holds two live leaves for one token.

### 2. Proposal opens: `AnonymousVoting.createProposal(contentHash, deadline)`

- **Sender:** the proposer's wallet, which must hold an NFT.
- **What an observer learns:**
  - who proposed;
  - the proposal content hash and deadline;
  - the snapshot `root`;
  - the electorate size, meaning the registered members at this moment.
- **Guard:** the call reverts if fewer than `minAnonymitySet` members are registered.
- **Consequence for Alice:** her vote on this proposal hides among exactly that
  electorate. Members who register later cannot vote on this proposal.

### 3. Preparing the vote: offchain, no transaction (`scripts/vote.mjs`)

1. Alice re-derives `s`. This is a local signature, not a transaction.
2. She reads the proposal and `scopeOf(p)`.
3. She downloads **all** `LeafSet` events up to the proposal's creation.
4. She rebuilds the tree, checks that it matches the snapshot root, and finds her
   own leaf locally.
5. She computes `nullifier = Poseidon(s, scope)` and generates the proof locally
   (about 1 s, 8,384 bytes).

**What the RPC endpoint learns:** that someone at this IP address read the
registry and a proposal. Every voter makes the same reads, and nothing
leaf-specific is queried.

The script deliberately does not pre-check `nullifierUsed(p, nullifier)`. That query
would show the RPC provider the nullifier before the vote appears, which would link
Alice's IP address to her vote.

### 4. Voting: `AnonymousVoting.castVote(p, support, nullifier, proof)`

Alice's client POSTs `{p, support, nullifier, proof}` to a relayer. The relayer
simulates the call and then sends it.

- **Sender:** `W_relay`, **never** `W_alice`.
  - `vote.mjs` refuses to send from the member wallet, or from any wallet that holds
    a membership NFT.
  - A "fresh" wallet funded from `W_alice` is just as bad as `W_alice` itself.
- **What an observer learns:**
  - *some* member of proposal `p`'s electorate voted `yes`/`no`, at this block time,
    through this relayer;
  - a nullifier that looks random. It is not linkable to `C`, to the leaf index, or
    to Alice's nullifiers on other proposals, because each proposal has its own
    scope.
  - the running tally goes up by one.
- **What the relayer learns:** the same as any observer, plus network metadata
  (Alice's IP address and timing). It cannot change or reattribute the vote.
- **Cost:** about 2.57M gas per vote (Honk verification), measured on anvil.
  Registration costs about 0.5–0.67M gas. On mainnet, the relayer's gas bill is
  real, so an L2 is the realistic home.

### 5. Tally: `AnonymousVoting.tally(p)`, a view call

- **Transaction:** none. This is a read that anyone can make after the deadline.
- **Result:** `(yes, no, electorate)`. `electorate − yes − no` did not vote.
- **What anyone learns:** the totals.

Let `n` be the number of votes cast. The totals only reveal individual votes when
the result is lopsided:

- If `yes == n` or `no == n`, everyone who voted voted the same way. Participation
  is still hidden.
- If `yes + no == electorate` and the result is unanimous, **every member's** vote
  is known.

Any scheme that publishes a tally has this property.

## Summary: who sends what

| # | Onchain tx | Sender | Observer learns | Links member to vote? |
|---|---|---|---|---|
| 0 | deploy ×4 | deployer | addresses, circuit | – |
| 1 | `register(tokenId, C)` | member's NFT wallet | NFT holder ↔ commitment `C` ↔ leaf index | No |
| 1' | `evict(tokenId)` (after a transfer) | anyone | that token's old leaf is dead | No |
| 2 | `createProposal(hash, deadline)` | any NFT holder | proposer, snapshot root, electorate size | No |
| 4 | `castVote(p, support, nullifier, proof)` | relayer / unlinked wallet | "an electorate member voted X", unlinkable nullifier, timing | **No**, if and only if the sender and funding are unlinked |
| 5 | `tally(p)` | none (view call) | yes / no / electorate | Only for unanimous results |

## What this does *not* protect against (read before deploying)

1. **Sending the vote from your own wallet**, or from a wallet you funded from it.
   This attributes the vote completely. The contract cannot prevent it, because
   `castVote` must accept any sender. The client refuses the obvious cases.
2. **Network metadata.**
   - The relayer and the RPC provider see IP addresses and timing.
   - If the DAO team runs the only relayer, "including us" relies on the team not
     logging.
   - Mitigations: several independent relayers, member-run relayers, and using Tor
     or a VPN for both the RPC and the relayer.
3. **Timing correlation.** Votes and the running tally are visible live.
   - Suppose Alice is the only one voting in a 10-minute window, and she mentions in
     chat that she "just voted". Her vote is then exposed.
   - Relayer batching with random delays would reduce this. It is **not
     implemented**.
   - `tally()` only defines the official result. It does not hide the live count.
   - Hiding the live count as well would need commit-reveal or timelock/threshold
     encryption.
4. **Small anonymity sets.** Anonymity is among *registered* members at snapshot
   time, not all 150 NFT holders.
   - `MIN_ANONYMITY_SET` enforces a floor on proposal creation.
   - Set it high, and get every member to register early.
5. **Secret compromise is retroactive.** Anyone who learns `s`, or the derivation
   signature, can:
   - compute Alice's nullifier for every past proposal and read her past votes;
   - vote as her on open proposals.
   Rotating the key does not protect past votes. Only sign the derivation message in
   the voting client. Don't share nullifiers either: a nullifier plus its onchain
   `VoteCast` is the vote.
6. **Not receipt-free.** Alice can *prove* how she voted by revealing `s`, so vote
   buying and coercion are possible.
   - Fixing this (MACI-style) needs a coordinator who can decrypt votes, which
     conflicts with "nobody, including us". We chose unattributability over coercion
     resistance.
7. **Membership integrity comes from the NFT.** Whoever can mint membership NFTs
   can mint extra voters. Whoever can burn them can remove voters.
   - The voting system adds no admin power of its own, but it can't be more honest
     than the NFT.
   - Eviction after a sale needs someone to call `evict`. Until then, and for
     proposals already snapshotted, the seller's old leaf still counts.
8. **Proposers are public.** Only votes are anonymous.

## Verification done

- `nargo test`: 3 tests. A valid vote verifies; a non-binary vote fails; a wrong
  root fails.
- `forge test`: 6 tests.
  - The Poseidon output matches the circomlib test vector.
  - The incremental tree matches a naive full rebuild after insert, rotate, evict
    and re-register.
  - Registration rules.
  - The anonymity-set floor.
  - The full vote lifecycle, including double votes, a nullifier + r, a bad proof,
    and deadline gates. This test uses a mock verifier.
- `npm run demo`, with real proofs against the real verifier on anvil: 3 members
  register, 3 relayed votes, a re-vote is rejected with `AlreadyVoted`, and the
  tally is `yes 2, no 1`.
