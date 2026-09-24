# Anonymous DAO Voting Core

This core uses public membership wallets only for joining the voting anonymity set. A vote proof is submitted from a relayer wallet, so the public member wallet is not the sender of the vote transaction.

## One Member, One Proposal

1. The DAO deployer deploys `MembershipNFT`, the Noir-generated `HonkVerifier`, and `AnonymousVoting`. `AnonymousVoting` is constructed with the membership NFT and verifier addresses.

2. The DAO deployer mints a soulbound membership NFT to each public member wallet. A chain observer learns the DAO membership list, which is already public for this DAO.

3. The member locally generates two random field elements: `nullifier` and `secret`. Their membership commitment is `Poseidon(nullifier, secret)`. The member must persist both values and the emitted leaf index; losing them means they cannot vote from that commitment.

4. The member wallet sends `AnonymousVoting.join(commitment)`. The contract checks `MembershipNFT.balanceOf(msg.sender) > 0`, enforces one commitment per member wallet, inserts the commitment into the fixed-depth Poseidon tree, stores the new root, and emits `CommitmentInserted(memberWallet, leafIndex, commitment, root)`. A chain observer learns that this public member joined the anonymity set at that leaf, but not the member's future vote.

5. The DAO deployer creates a yes/no proposal with `createProposal(proposalId, deadline)`. A chain observer learns the proposal id and deadline.

6. The member rebuilds the Merkle tree offchain by replaying `CommitmentInserted` events, derives their Merkle path, and generates a Noir proof. The public inputs are ordered exactly as the contract sends them to the verifier: `root`, `proposalId`, `nullifierHash`, `vote`. The private inputs are `nullifier`, `secret`, `pathElements`, and `pathIndices`.

7. The proof enforces three facts without revealing the member: the private note opens to a commitment in a known membership root, `vote` is either `0` or `1`, and `nullifierHash = Poseidon(nullifier, proposalId)`. Scoping the nullifier to `proposalId` prevents linking the same member's votes across different proposals.

8. A relayer wallet, not the member wallet, sends `castVote(proposalId, root, nullifierHash, vote, proof)`. The contract checks the root is known, verifies the Noir proof, rejects repeated `nullifierHash` values for that proposal, and increments either `yes` or `no`. A chain observer learns one valid member voted yes or no on that proposal, but does not learn which member commitment produced the vote unless the member or relayer leaks it out of band.

9. After the deadline, anyone can call `tally(proposalId)` and read `(yes, no, final)`. Before the deadline the stored counters are public contract state too, so this core gives public running totals; hide-until-deadline tallying would require an additional encrypted tally or commit/reveal layer.

## Local Run Sketch

Start a local chain:

```bash
anvil
```

Compile the circuit, generate the verifier, and build contracts:

```bash
cd circuits/vote && HOME=$PWD/.home nargo compile --package anonymous_vote && cd ../..
bb write_vk -b circuits/vote/target/anonymous_vote.json -o circuits/vote/target -t evm
bb write_solidity_verifier -k circuits/vote/target/vk -o src/Verifier.sol -t evm --optimized
forge build
```

Deploy:

```bash
forge script script/Deploy.s.sol:Deploy --rpc-url http://127.0.0.1:8545 --broadcast
```

Then set `OWNER_KEY`, `MEMBER_KEY`, `RELAYER_KEY`, `MEMBERSHIP_ADDRESS`, `VOTING_ADDRESS`, and `PROPOSAL_ID` and run. If the member has not been minted an NFT or the proposal does not exist, `OWNER_KEY` lets the script create that setup on a local chain:

```bash
node scripts/vote.mjs
```
