# Private DAO Vote Core

This core gives public members an anonymous, proposal-scoped voting credential:

- A member keeps a private note: `nullifier` and `secret`.
- The public join commitment is `Poseidon(nullifier, secret)`.
- The vote nullifier is `Poseidon(nullifier, proposalId)`, so the same member cannot vote twice on one proposal, but their votes are not linkable across proposals.
- The Noir proof shows that the voter knows a note included in a known onchain Merkle root and that the public nullifier was derived correctly.
- The sample membership NFT is non-transferable, so a single membership cannot join, transfer, and join again from another wallet.

## Local Setup

Compile and test:

```bash
npm install
npm run test:circuits
npm run build:circuits
forge build
```

Deploy on a local Anvil chain:

```bash
anvil
forge script script/Deploy.s.sol:DeployLocal \
  --rpc-url http://127.0.0.1:8545 \
  --broadcast \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

Submit one member vote through the Node flow:

```bash
PRIVATE_VOTE_ADDRESS=<deployed PrivateVote address> npm run vote:local
```

If `PRIVATE_VOTE_ADDRESS` is omitted, the Node script deploys a fresh local stack itself, then joins and votes. The script stores the demo member note under `private-notes/`, which is ignored by git. Real notes must be backed up privately; losing the note means losing the ability to vote with that commitment.

## One-Member Flow

1. Deployment transaction

Sender: DAO deployer/admin wallet.

Action: deploys `MembershipNFT`, `HonkVerifier`, `PoseidonT3`, and `PrivateVote`; mints sample membership NFTs; creates proposal `1`.

Observer learns: contract addresses, membership NFT recipients, proposal id, proposal deadline, and that the DAO/admin set up this vote. No member vote or secret is involved.

2. Join transaction

Sender: the member wallet that publicly holds the membership NFT.

Action: calls `PrivateVote.join(commitment)` where `commitment = Poseidon(nullifier, secret)`.

Observer learns: this public member joined the voting anonymity set at a specific leaf index, and sees the commitment plus updated Merkle root. The observer does not learn the nullifier, secret, future vote, or which proposal the member will vote on. Joining is intentionally public because membership is public.

3. Proof generation

Sender: no onchain sender; this happens offchain on the member device.

Action: the client rebuilds the Merkle tree by replaying `CommitmentJoined` events, derives the member path, and uses NoirJS plus `@aztec/bb.js` to prove:

- the member knows `nullifier` and `secret`,
- `Poseidon(nullifier, secret)` is in a known root,
- `nullifierHash = Poseidon(nullifier, proposalId)`,
- `vote` is either `0` or `1`.

Observer learns: nothing, unless the member leaks their note or proof inputs before submission.

4. Vote transaction

Sender: a relayer wallet, not the member wallet.

Action: calls `PrivateVote.submitVote(proposalId, support, proof, publicInputs)`.

Observer learns: some member in the joined anonymity set voted yes or no on that proposal, and the proposal-scoped nullifier hash was consumed. The observer sees the relayer address, proof, root, proposal id, vote bit, and nullifier hash. They do not learn which joined member produced the proof, assuming the relayer path is not linked back to the member wallet.

Important: if the member sends this transaction from their membership wallet, privacy is lost. If they fund a burner directly from the membership wallet, that can also link them. Use a real relayer, paymaster, or other unlinkable submission path.

5. Tally read

Sender: anyone, after the deadline, via `finalTally(proposalId)`.

Action: reads final yes/no counts.

Observer learns: the final tally. The contract also emits individual anonymous vote events, so live yes/no increments are observable onchain as they happen; what remains hidden is attribution to a member.

## Privacy Boundary

This design hides the link between public membership wallets and vote choices. It does not hide that a member joined the voting pool, the total number of joined commitments, the timing of anonymous votes, or the vote choice attached to each anonymous vote transaction. The anonymity set for a vote is the set of joined members under the root used by the proof.
