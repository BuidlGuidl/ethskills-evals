# Private DAO Vote Core

This is a Semaphore-style yes/no voting core for a public-member DAO. A member has a private `identity_secret`; their public voting commitment is `hash1(identity_secret)`. Proposal roots are Merkle roots over registered commitments. A vote proof shows:

- the prover knows an `identity_secret` whose commitment is in the proposal root;
- the public vote is `0` or `1`;
- the public nullifier is `hash4(identity_secret, proposalId, governorAddress, chainId)`.

The nullifier prevents double voting on the same proposal without revealing which registered member voted.

## Source Layout

- Noir circuit: `circuits/vote/src/main.nr`
- Solidity contracts: `src/MembershipNFT.sol`, `src/PrivateGovernor.sol`, generated `src/Verifier.sol`
- Foundry deploy script: `script/Deploy.s.sol`
- Node deploy script: `scripts/deployLocal.mjs`
- Member vote demo: `scripts/castVote.mjs`

## Running Locally

Start Anvil:

```sh
anvil
```

Build circuits and contracts:

```sh
npm install
npm run gen:verifier
npm run build
```

Deploy only:

```sh
npm run deploy:local
```

Run one complete local vote demo:

```sh
npm run prove:vote
```

The vote script will deploy a stack if `deployed.json` or `MEMBERSHIP_ADDRESS`/`GOVERNOR_ADDRESS` are not present. It mints one demo membership NFT, registers one commitment, creates one proposal root, generates a Noir/UltraHonk proof, and submits the vote from a relayer wallet.

## End-to-End Flow

1. Deploy contracts.

Sender: DAO deployer wallet.

Transactions: deploy `MembershipNFT`, generated verifier libraries, `HonkVerifier`, and `PrivateGovernor`.

Observer learns: contract addresses, DAO deployer address, and that the governor is wired to the membership NFT and verifier. No member vote information exists yet.

2. Mint membership NFT.

Sender: DAO owner wallet.

Transaction: `MembershipNFT.mint(memberWallet)`.

Observer learns: `memberWallet` is a DAO member. This is already public in the problem statement.

3. Register voting commitment.

Sender: member wallet.

Transaction: `PrivateGovernor.registerCommitment(commitment)`, where `commitment = hash1(identity_secret)`.

Observer learns: this public member registered this public commitment. They do not learn `identity_secret`. Later votes reveal only a Merkle root and nullifier, not the commitment leaf, so this registration does not identify the vote.

4. Create proposal.

Sender: DAO owner wallet.

Transaction: `PrivateGovernor.createProposal(root, deadline)`, where `root` is the Merkle root over the registered voting commitments for that proposal snapshot.

Observer learns: the eligible anonymity set root and the vote deadline. For a 150-member DAO, the root should include all 150 registered commitments.

5. Generate proof offchain.

Sender: no onchain sender; this is local member computation.

The member computes their Merkle path, selects yes/no, computes `nullifierHash = hash4(identity_secret, proposalId, governorAddress, chainId)`, and generates a Noir proof.

Observer learns: nothing, unless the member leaks their secret or proof-generation environment.

6. Submit vote.

Sender: relayer wallet, not the member wallet.

Transaction: `PrivateGovernor.castVote(proposalId, vote, nullifierHash, proof)`.

Observer learns: one valid eligible member voted yes or no on that proposal, and the nullifier used for double-vote prevention. They see the relayer address, not the member wallet. They cannot link `nullifierHash` to a registered commitment or membership wallet under the circuit assumptions.

7. Read tally after deadline.

Sender: anyone using `eth_call`.

Call: `PrivateGovernor.tally(proposalId)`.

Observer learns: final yes/no totals. Individual vote attribution is still not revealed by the tally.

## Privacy Notes

The member should not submit `castVote` directly from their known member wallet. The included script uses a relayer wallet for this reason. If a member sends their own vote transaction, the proof remains zero-knowledge, but transaction metadata would reveal who submitted that vote.

The vote value itself is public per ballot, so observers see each anonymous yes/no as it arrives. If the DAO needs even per-ballot vote contents hidden until the deadline, this design would need encrypted votes or threshold decryption in addition to anonymous membership proofs.

