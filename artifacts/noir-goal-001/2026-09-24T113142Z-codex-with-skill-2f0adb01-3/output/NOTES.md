# Anonymous Governance Core

This core uses a commitment-nullifier flow. The public member wallet joins a proposal by inserting a secret commitment into that proposal's Merkle tree. Later, a different wallet submits a Noir proof that it knows one committed note, reveals a proposal-scoped nullifier to prevent double voting, and sends the yes/no choice.

The circuit public inputs are ordered exactly as the Solidity verifier call expects:

1. `merkle_root`
2. `proposal_id`
3. `nullifier_hash`
4. `vote_choice`

## One Member, One Proposal

1. Deploy

   Wallet: DAO/deployer wallet.

   Transaction: deploys verifier support libraries, `HonkVerifier`, `PoseidonT3`, `DemoMembershipNFT`, and `AnonymousGovernance`, then wires the governance contract to the verifier and membership NFT.

   Observer learns: contract addresses and that this governance instance uses the verifier for the `circuits/vote` circuit and Poseidon for the membership tree.

2. Membership setup

   Wallet: DAO/deployer wallet.

   Transaction: mints a membership NFT to the member wallet.

   Observer learns: this wallet is a DAO member. Membership is intentionally public.

3. Proposal creation

   Wallet: any wallet in this demo, normally the DAO executor.

   Transaction: calls `createProposal(proposalId, joinDeadline, voteDeadline)`.

   Observer learns: proposal id and the join/vote windows.

4. Join the vote

   Wallet: the member's public membership wallet.

   Local secret work: the member generates `nullifier` and `secret`, then computes `commitment = Poseidon(1, Poseidon(nullifier, secret))`. The member must keep the note values and the emitted `leafIndex`; losing them means they cannot vote.

   Transaction: calls `joinProposal(proposalId, commitment)`.

   Observer learns: this known member joined the proposal and inserted this commitment at a leaf index. The observer does not learn `nullifier`, `secret`, or the future vote. Since all joined members publish commitments before voting, the anonymity set is the joined members, not the full registry.

5. Build witness and prove

   Wallet: no onchain wallet needed.

   Local secret work: the voter rebuilds the Merkle tree from `CommitmentInserted` events, derives siblings for their `leafIndex`, computes `nullifier_hash = Poseidon(Poseidon(2, proposalId), nullifier)`, and proves membership plus a valid yes/no `vote_choice`.

   Observer learns: nothing, because this step is local.

6. Cast vote

   Wallet: a fresh burner or relayer wallet, not the public member wallet. Gas funding must not create a traceable link back to the member.

   Transaction: calls `castVote(proposalId, proof, merkleRoot, nullifierHash, voteChoice)`.

   Observer learns: one valid joined member voted yes or no, and this proposal-scoped `nullifierHash` cannot vote again. The observer does not learn which commitment or member produced the proof unless the voter links the relayer/burner wallet to their membership wallet.

7. Tally

   Wallet: no transaction required to read; anyone can call `tally(proposalId)`.

   Observer learns: yes and no totals. This demo increments public counts as votes arrive, so the running tally is observable before the deadline even though member attribution is hidden.

## Running Locally

Start a local chain:

```bash
anvil
```

Build the circuit and verifier, then contracts:

```bash
npm run build
```

Deploy:

```bash
npm run deploy:local
```

Run one member through join, proof generation, and vote submission:

```bash
npm run member:vote
```

The vote transaction must be sent by a wallet that is unlinkable to the public member wallet. If the member sends `castVote` from the same wallet that joined, chain observers can link the vote to that member despite the ZK proof.
