# Private DAO vote core

This prototype gives each proposal its own commitment tree. A member joins a proposal by publishing a Poseidon commitment derived from a private `(secret, nullifier)` note. Later, an unlinkable relayer submits a Noir proof that the voter knows a note in the proposal tree, that the nullifier is scoped to this proposal, and that the vote is either yes or no.

The anonymity set for a proposal is the set of members who inserted commitments for that proposal. The member wallet must not send `castVote`; doing that would publicly link the membership wallet to the hidden vote proof.

## One member, one proposal

1. Deploy locally.
   - Sender: deployer wallet.
   - Transaction: deploy `SimpleMembershipNFT`, generated `HonkVerifier`, and `PrivateVote`.
   - Observer learns: contract addresses and that the deployer controls proposal creation in this demo.

2. Mint membership.
   - Sender: the member wallet, or any wallet calling this demo NFT's open `mint`.
   - Transaction: `SimpleMembershipNFT.mint(member)`.
   - Observer learns: this wallet is a DAO member. This is already public in the stated requirements.

3. Create a proposal.
   - Sender: DAO owner/deployer wallet.
   - Transaction: `PrivateVote.createProposal(deadline)`.
   - Observer learns: proposal id, voting deadline, and the empty tree root. No vote information exists yet.

4. Join the proposal.
   - Sender: member wallet.
   - Local private action first: generate random field elements `secret` and `nullifier`, store them as a private note, and compute `commitment = Poseidon(secret, nullifier)`.
   - Transaction: `PrivateVote.joinProposal(proposalId, commitment)`.
   - Observer learns: the public member wallet joined this proposal and the commitment's leaf index/root. They do not learn the note, the future nullifier hash, or the vote.

5. Rebuild the path.
   - Sender: no transaction.
   - Local private action: replay `CommitmentInserted` events for the proposal and build the same depth-8 Poseidon Merkle tree offchain. The script checks its root against the contract event.
   - Observer learns: nothing new.

6. Generate the vote proof.
   - Sender: no transaction.
   - Local private action: run NoirJS with private inputs `secret`, `nullifier`, Merkle path elements, and path indices. Public inputs are ordered as `root`, `nullifierHash`, `proposalId`, `vote`.
   - Observer learns: nothing until the proof is submitted.

7. Submit the vote.
   - Sender: relayer wallet, not the member wallet.
   - Transaction before the deadline: `PrivateVote.castVote(proposalId, vote, root, nullifierHash, proof)`.
   - Observer learns: a valid member in the proposal's commitment tree cast a yes/no vote through this relayer, and that the same `nullifierHash` cannot vote again on this proposal. They cannot link the proof to the member wallet or commitment unless the relayer or timing/operational metadata gives it away.

8. Read the tally.
   - Sender: anyone using a view call, no transaction required.
   - Call: `PrivateVote.tally(proposalId)`.
   - Observer learns: final yes/no totals after the deadline. Individual vote attribution remains hidden inside the proposal anonymity set. The simple contract emits each vote choice as it is cast; it hides attribution, not the running aggregate.

## Build and run

```bash
nargo compile --package private_vote --workspace circuits/vote
bb write_vk -b target/private_vote.json -o target/vk -t evm
bb write_solidity_verifier -k target/vk -o src/Verifier.sol -t evm --optimized
forge build
```

For a local chain:

```bash
anvil
npm run deploy:local
MEMBERSHIP_ADDRESS=0x... VOTE_ADDRESS=0x... node scripts/vote-one-member.mjs
```
