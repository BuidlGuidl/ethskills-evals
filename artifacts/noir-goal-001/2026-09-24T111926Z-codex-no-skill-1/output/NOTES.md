# Private DAO Voting Core

This repo implements a fixed-depth private voting core for a 150-member DAO:

- `circuits/vote/src/main.nr` proves that a voter knows a secret whose commitment is in the registered-member Merkle tree.
- `src/PrivateVote.sol` stores public membership commitments, proposal roots, nullifiers, and yes/no tallies.
- `src/Verifier.sol` is the Barretenberg Solidity verifier generated from the Noir circuit.
- `script/Deploy.s.sol` deploys the verifier, demo membership NFT, and voting contract on a local chain.
- `js/voteMember.js` shows one member deriving a commitment/nullifier from a secret, generating a proof, and submitting a vote transaction.

The tree depth is 8, so this demo supports up to 256 registered commitments. That covers the requested 150 members. The field hash is implemented in Noir, Solidity, and Node so the demo is reproducible without external hash packages. For production, replace it with an audited Poseidon/MiMC implementation and regenerate the verifier.

## Local Commands

Start a local chain:

```sh
anvil
```

Build the contracts:

```sh
forge build
```

Deploy with Foundry:

```sh
forge script script/Deploy.s.sol:Deploy \
  --rpc-url http://127.0.0.1:8545 \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
  --broadcast --json
```

Run the full one-member demo. If `PRIVATE_VOTE_ADDRESS` and `MEMBERSHIP_NFT_ADDRESS` are unset, the script deploys fresh contracts first.

```sh
npm install
node js/voteMember.js
```

Useful overrides:

```sh
RPC_URL=http://127.0.0.1:8545 \
DEPLOYER_PRIVATE_KEY=... \
MEMBER_PRIVATE_KEY=... \
RELAYER_PRIVATE_KEY=... \
MEMBER_SECRET=... \
PROPOSAL_ID=42 \
VOTE_CHOICE=1 \
node js/voteMember.js
```

## End-To-End Flow

### 1. Deploy

Transaction sender: DAO deployer wallet.

Onchain action: `script/Deploy.s.sol` deploys `HonkVerifier`, `DemoMembershipNFT`, and `PrivateVote`, then passes the verifier and NFT addresses into `PrivateVote`.

What a chain observer learns: the deployed contract addresses and that the deployer controls the demo NFT minter. No member vote information exists yet.

### 2. Membership NFT Mint

Transaction sender: DAO deployer wallet.

Onchain action: `DemoMembershipNFT.mint(memberWallet)` gives the public member wallet a membership token.

What a chain observer learns: `memberWallet` is a DAO member. This matches the stated public-membership model.

### 3. Secret Commitment Registration

Transaction sender: member wallet that owns the membership NFT.

Offchain action before the transaction: the member chooses a high-entropy private `secret` and computes `commitment = hash2(1, secret)`.

Onchain action: `PrivateVote.register(tokenId, commitment)` checks that `msg.sender` owns the membership NFT, appends `commitment` to the Merkle tree, and records the new root.

What a chain observer learns: this public member registered this public commitment at this leaf index. The observer does not learn `secret`, and later votes reveal only a nullifier derived from `secret`, not the commitment itself.

Privacy note: registration should happen before live contested votes, preferably in a batch/window, so timing does not make later participation easier to guess.

### 4. Proposal Creation

Transaction sender: any wallet; in the demo, the deployer wallet.

Onchain action: `PrivateVote.createProposal(proposalId, merkleRoot, deadline)` binds a proposal to a known registered-member Merkle root and a deadline.

What a chain observer learns: proposal id, eligible voter set root, and deadline. The observer learns which registered commitments are eligible only because registrations are public, but not which eligible commitment will later vote.

### 5. Proof Generation

Transaction sender: none; this is local/offchain.

Offchain action: the member computes:

- Merkle path from their commitment to the proposal root.
- `nullifier = hash2(hash2(2, proposalId), secret)`.
- Noir witness containing `secret`, Merkle path, direction bits, `proposalId`, root, nullifier, and yes/no vote bit.
- Barretenberg proof for the Noir circuit.

What a chain observer learns: nothing. This is done locally.

### 6. Vote Submission

Transaction sender: relayer/burner wallet, not the member wallet.

Onchain action: `PrivateVote.castVote(proposalId, merkleRoot, nullifier, vote, proof)` verifies the proof, rejects reused nullifiers for the proposal, and increments yes or no.

What a chain observer learns: a valid eligible member voted yes/no on the proposal, and the public nullifier cannot vote again on that proposal. The observer does not learn which registered commitment or member wallet produced the proof.

Important: if the member wallet submits `castVote` directly, observers can associate that wallet with the vote transaction. Use a relayer, burner wallet, or private transaction path for vote submission.

### 7. Tally

Transaction sender: none for reads; anyone can call `tally(proposalId)`.

Onchain action: after the deadline, anyone reads `(yesVotes, noVotes, final)`.

What a chain observer learns: final yes/no totals and all public vote nullifiers. They still do not learn which member cast which vote, assuming the secret remains private and vote submission is not linked at the wallet/network layer.

