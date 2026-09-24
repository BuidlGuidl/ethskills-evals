# Anonymous DAO Voting Core

This project uses the commitment-nullifier pattern. A member joins the voting anonymity set from their public membership wallet, then submits a vote proof from a different wallet. That second wallet can be a burner, a relayer, or an account-abstraction wallet funded by a paymaster.

## One-Member Flow

1. The DAO deployer deploys `HonkVerifier`, `SimpleMembershipNFT`, and `NoirPrivateVoting`, then creates a proposal.

   Observer learns the contract addresses, the verifier used by the voting contract, the membership NFT address, the proposal id, and the voting deadline.

2. The DAO or registry owner mints a membership NFT to the member wallet.

   Sender: DAO deployer/registry wallet. Observer learns that this wallet is a public DAO member. This is already public in the problem statement.

3. The member locally creates a private note:

   `nullifier`, `secret`, `commitment = Poseidon(1, Poseidon(nullifier, secret))`.

   No transaction happens here. Nobody learns the nullifier or secret. Losing these values means the member cannot later vote with that commitment.

4. The member wallet calls `joinVote(commitment)`.

   Sender: the public membership wallet that owns the NFT. Observer learns that this member joined the anonymity set and sees the commitment, leaf index, and new Merkle root. Observer does not learn the nullifier or secret. This transaction intentionally does not reveal the future vote.

5. The member's client rebuilds the LeanIMT tree by replaying `CommitmentInserted` events and generates a Noir proof.

   The proof shows: "I know a nullifier and secret whose commitment is in an accepted root, and this proposal-scoped nullifier has this hash." The public inputs are `merkle_root`, `proposal_id`, `vote`, and `nullifier_hash`.

6. A burner or relayer wallet calls `castVote(proof, merkleRoot, proposalId, support, nullifierHash)`.

   Sender: not the membership wallet. Observer learns that some joined member voted yes or no on that proposal, and learns the proposal-scoped nullifier hash that prevents double voting. Observer does not learn which commitment was used and cannot link the vote to a member unless the member reuses their membership wallet or otherwise leaks the note.

7. The contract verifies the proof, rejects reused nullifiers, and increments the yes/no count.

   Observer learns the updated public tally. The contract also emits `VoteCast(proposalId, nullifierHash, support)`.

8. After the deadline, anyone calls or reads `finalTally(proposalId)`.

   Observer learns the final yes/no tally. They still only see nullifier hashes and vote choices, not member identities.

## Important Privacy Notes

The membership wallet must not submit the vote transaction. If it does, the chain trivially links that member to the vote sender even though the proof itself is zero knowledge.

The anonymity set is the set of joined commitments. For a 150-member DAO, privacy is strongest when many members join before voting starts. A tiny joined set gives weak practical anonymity.

Votes are public as they are cast in this core. That satisfies vote non-attribution, but it does not hide interim tally movement from chain observers.

## Commands

Run a local chain, then in another terminal:

```bash
npm --cache .npm-cache install
npm run build
npm run deploy:local
npm run vote:local
```

`npm run build:circuit` compiles the Noir circuit and regenerates `contracts/src/verifiers/HonkVerifier.sol` from the verification key using `--oracle_hash keccak`.
