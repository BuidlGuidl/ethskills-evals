# Anonymous DAO Voting Core

This core uses a Merkle-membership proof plus a per-proposal nullifier.

- A member privately holds `secret`.
- Their public voting credential is `leaf = hash2(secret, 1)`.
- The DAO/site maintains a Merkle tree of member leaves and publishes accepted roots through `MemberRootRegistry`.
- For a proposal, a voter proves in Noir that they know a secret whose leaf is in an accepted root, and that `nullifier = hash2(secret, proposal_id)`.
- `AnonymousVoting` verifies the proof, checks the nullifier has not been used, and increments the yes/no tally.

The verifier in [src/Verifier.sol](/Users/liana/.cache/ethskills-evals/2026-09-24T111926Z-codex-no-skill-2/noir-goal-001/src/Verifier.sol) is generated from the Noir circuit in [src/main.nr](/Users/liana/.cache/ethskills-evals/2026-09-24T111926Z-codex-no-skill-2/noir-goal-001/src/main.nr).

## Local Commands

Install dependencies and compile:

```sh
npm install --cache ./cache/npm
npm run compile:circuit
forge build
```

Generate a sample proof without sending a transaction:

```sh
DRY_RUN=1 npm run vote
```

Use the printed `member root` as `MEMBER_ROOT` when deploying to Anvil:

```sh
anvil
MEMBER_ROOT=0x... forge script script/Deploy.s.sol \
  --rpc-url http://127.0.0.1:8545 \
  --broadcast
```

The deploy script deploys `MembershipNFT`, `MemberRootRegistry`, `HonkVerifier`, and `AnonymousVoting`, wires the voting contract to the verifier and root registry, accepts the initial member root, and creates proposal `1` by default.

Then submit one sample member vote:

```sh
VOTING_ADDRESS=0x... PROPOSAL_ID=1 MEMBER_INDEX=0 VOTE=1 npm run vote
```

## One Member End-to-End

1. Membership exists.

   Transaction: `MembershipNFT.mint(memberWallet)`, sent by the DAO/admin wallet.

   What an observer learns: `memberWallet` is a DAO member. This is already public in the stated DAO model.

2. The member joins the anonymous voting set.

   The member generates `secret` locally and gives the DAO/site only `leaf = hash2(secret, 1)`. The DAO/site includes that leaf in the member Merkle tree.

   Transaction: `MemberRootRegistry.acceptRoot(root)`, sent by the DAO/root-operator wallet, or included in deployment as `MEMBER_ROOT`.

   What an observer learns: a member root is accepted. If the site publishes the registry, observers may know which public members have commitments, but they do not learn any member secret. Later votes do not reveal which leaf was used.

3. A proposal is opened.

   Transaction: `AnonymousVoting.createProposal(proposalId, metadataURI, deadline)`, sent by the DAO/admin wallet. The deploy script creates proposal `1` by default.

   What an observer learns: the proposal id, metadata URI, and deadline.

4. The member proves and submits a vote.

   Local private inputs: `secret`, Merkle path, Merkle path indices.

   Public inputs: `root`, `proposal_id`, `nullifier`, `vote`.

   Transaction: `AnonymousVoting.submitVote(...)`, sent by a relayer or fresh unlinkable wallet, not by the member's public membership wallet.

   What an observer learns: one valid member voted yes/no on that proposal, using that accepted root and nullifier. The observer can see the sender wallet, so using the public member wallet would destroy sender-level anonymity. The observer cannot tell which member leaf generated the proof, and the nullifier prevents the same secret from voting twice on the same proposal.

5. The tally is read.

   Read: `AnonymousVoting.tally(proposalId)`, called by anyone after the deadline.

   What an observer learns: the yes/no counts. In this core, votes are public as yes/no when submitted, so the running tally is also visible before the deadline. The privacy goal implemented here is vote unattributability, not hidden interim results.

## Notes And Limits

- The nullifier includes `proposal_id`, so the same member's votes on different proposals are not linked by nullifier.
- A member can vote at most once per proposal because `AnonymousVoting` rejects reused nullifiers.
- `scripts/member_vote.js` uses deterministic sample member secrets for local demos. Real members must use high-entropy private secrets and the script should be pointed at the DAO's real member leaf set.
- This repository uses a small demo field hash implemented consistently in Noir, Solidity, and Node so the core is self-contained. Replace it with an audited SNARK-friendly hash such as Poseidon/Poseidon2 before production use.
- Use a relayer, a mixer-funded fresh wallet, account abstraction paymaster, or batch submission service for `submitVote`. The zero-knowledge proof hides the member leaf, but it cannot hide the transaction sender.
