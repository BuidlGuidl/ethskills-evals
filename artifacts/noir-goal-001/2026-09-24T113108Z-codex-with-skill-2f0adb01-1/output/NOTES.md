# Private DAO Voting Core

This core implements a commitment-nullifier voting flow for public DAO members.
The membership set is public, but a vote is cast from a fresh wallet with a
zero-knowledge proof that it belongs to one proposal's joined member set.

The yes/no choice is public on the anonymous vote transaction. The privacy goal
is non-attribution: chain observers can see that some eligible joined member
voted yes or no, but not which member wallet did it.

## Build And Local Run

```bash
npm install --cache ./.npm-cache
npm run build
anvil --code-size-limit 40960
npm run deploy:local
VOTER_PRIVATE_KEY=0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690 npm run vote:local
```

`npm run deploy:local` deploys:

- `MockMembershipNFT`
- generated `HonkVerifier`
- `PrivateVoteGovernor`

It also mints one membership NFT to the deployer and creates proposal `1`.
The generated verifier is large, so the local Anvil/deploy path uses a
local-only code size limit.

## What The Circuit Proves

Circuit: `circuits/vote/src/main.nr`

Private inputs:

- `nullifier`
- `secret`
- `vote`
- Merkle proof path for the member's proposal commitment

Public inputs, in this exact verifier order:

- `merkle_root`
- `proposal_id`
- `vote_choice`
- `nullifier_hash`

The proof establishes:

- The voter knows `nullifier` and `secret`.
- `Poseidon(1, Poseidon(nullifier, secret))` is in an accepted proposal Merkle root.
- `nullifier_hash = Poseidon(Poseidon(2, proposal_id), nullifier)`.
- `vote_choice` is the boolean private `vote`.

The proposal id is part of the nullifier, so the same member can vote once per
proposal across many proposals.

## One Member Flow

### 1. Proposal Creation

Transaction: `createProposal(joinDeadline, voteDeadline)`

Sender: DAO admin wallet.

Observer learns:

- A proposal exists.
- Its join and vote deadlines.
- Nothing about member choices.

### 2. Join The Proposal

The member locally generates:

- `nullifier`
- `secret`
- `commitment = Poseidon(1, Poseidon(nullifier, secret))`

Transaction: `joinProposal(proposalId, commitment)`

Sender: the member's public membership wallet, which holds the membership NFT.

Observer learns:

- This public member joined this proposal's anonymity set.
- The member's opaque commitment and its leaf index.
- The current Merkle root.
- No vote choice, nullifier, or secret.

Privacy note:

- The member must save `nullifier`, `secret`, `commitment`, proposal id, contract address, and leaf index.
- Joining is public. For better anonymity, members should join before choices are socially obvious, and many members should join.

### 3. Build The Witness Offchain

No transaction.

The voter/client replays `CommitmentInserted` events for the proposal, rebuilds
the LeanIMT tree, and derives the Merkle siblings for the saved commitment.

Observer learns:

- Nothing from this local step.

### 4. Cast The Vote Anonymously

The member uses a fresh funded wallet or relayer wallet that is not linked to
the membership wallet.

Transaction: `castVote(proposalId, merkleRoot, support, nullifierHash, proof)`

Sender: fresh anonymous vote wallet, not the membership wallet.

Observer learns:

- A valid joined member voted on the proposal.
- The yes/no choice for this anonymous ballot.
- The proposal-scoped `nullifierHash`.
- The transaction sender, which should be a burner or relayer.

Observer does not learn:

- Which joined commitment was used.
- Which member wallet created that commitment.
- The member's `nullifier` or `secret`.

The contract rejects:

- Unknown roots.
- Reused nullifiers for the same proposal.
- Invalid proofs.
- Votes after the deadline.

### 5. Read The Tally

Transaction: none for reading. Call `tally(proposalId)` after `voteDeadline`.

Sender: anyone, as a view call.

Observer learns:

- Final yes and no counts.

The contract also stores running counts internally while votes are cast. The
public `tally` helper intentionally reverts before the deadline, but raw chain
state and `VoteCast` events are still public like any EVM data.

## Privacy Assumptions

The critical operational rule is that `joinProposal` and `castVote` must not be
sent by the same wallet. If the member wallet casts the vote, `msg.sender` links
the vote to the member and defeats the privacy goal.

A chain observer can still use timing, gas funding, RPC metadata, or a tiny
anonymity set to make guesses. In production, fund the vote wallet privately or
use a relayer/paymaster, and encourage broad proposal joining.

