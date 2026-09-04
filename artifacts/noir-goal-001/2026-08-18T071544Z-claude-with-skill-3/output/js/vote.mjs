#!/usr/bin/env node
// Step 3 of the member flow: one member, one secret, one anonymous ballot.
//
//   node js/vote.mjs --proposal 0 --vote yes \
//     --member-key 0x<member privkey> --relayer-key 0x<burner privkey>
//
// The two keys do different jobs and that separation is the whole point:
//
//   --member-key   signs ONE offline message to re-derive the voting identity.
//                  It never sends a transaction here and never touches the RPC.
//   --relayer-key  a wallet with no membership NFT and no registration. It pays
//                  gas and appears as msg.sender on the ballot transaction.
//                  AnonVoting rejects ballots from registered member wallets.
//
// Everything between the two is local computation: rebuild the member tree from
// public events, derive a Merkle witness, prove in Noir.

import { Wallet } from "ethers";
import { deriveIdentity, identityFromSigner, nullifierHashFor } from "./lib/identity.mjs";
import { buildMemberTree } from "./lib/tree.mjs";
import { buildBallot } from "./lib/prove.mjs";
import { anonVoting, loadDeployment, provider } from "./lib/contracts.mjs";
import { parseArgs } from "./lib/args.mjs";

const args = parseArgs();
const proposalId = Number(args.proposal ?? 0);
const voteWord = String(args.vote ?? "yes").toLowerCase();
if (!["yes", "no", "1", "0"].includes(voteWord)) throw new Error("--vote must be yes|no");
const vote = voteWord === "yes" || voteWord === "1" ? 1 : 0;

const memberKey = args["member-key"] ?? process.env.MEMBER_PRIVATE_KEY;
const relayerKey = args["relayer-key"] ?? process.env.RELAYER_PRIVATE_KEY;
if (!memberKey && !args.secret) throw new Error("pass --member-key 0x... (or --secret 0x...)");
if (!relayerKey) throw new Error("pass --relayer-key 0x... — never submit your own ballot");

const deployment = await loadDeployment();
const rpc = provider(args.rpc);
const relayer = new Wallet(relayerKey, rpc);
const reader = anonVoting(deployment.anonVoting, rpc);

// ---------------------------------------------------------------- 1. identity
// Offline. The member's wallet signs a fixed domain string; nothing is sent.
const identity = args.secret
  ? deriveIdentity(args.secret)
  : await identityFromSigner(new Wallet(memberKey));

console.log("1. identity (offline, no RPC)");
console.log(`   commitment      ${identity.commitment}`);

// ------------------------------------------------------- 2. read public state
const info = await reader.proposalInfo(proposalId);
const [pinnedRoot, memberCount, deadline, ballotsCast, description] = info;
const now = Math.floor(Date.now() / 1000);

console.log(`\n2. proposal #${proposalId}: "${description}"`);
console.log(`   pinned root     ${pinnedRoot}`);
console.log(`   anonymity set   ${memberCount} members`);
console.log(`   deadline        ${new Date(Number(deadline) * 1000).toISOString()}`);
console.log(`   ballots so far  ${ballotsCast}`);
if (now >= Number(deadline)) throw new Error("voting has closed for this proposal");

const nullifierHash = nullifierHashFor(identity.identityNullifier, proposalId);
if (await reader.nullifierSpent(nullifierHash)) {
  throw new Error("this identity has already voted on this proposal");
}

// ------------------------------------------------- 3. rebuild the member tree
// The proposal pinned the root as of its creation block, so replay registration
// events only up to that block. The contract stores no witness paths; every
// client reconstructs the same tree from the same public log.
const created = await reader.queryFilter(reader.filters.ProposalCreated(proposalId), 0, "latest");
if (created.length === 0) throw new Error(`no ProposalCreated event for proposal ${proposalId}`);
const snapshotBlock = created[0].blockNumber;

const { tree } = await buildMemberTree(reader, deployment.deployBlock ?? 0, snapshotBlock);
console.log(`\n3. member tree rebuilt from events up to block ${snapshotBlock}`);
console.log(`   leaves          ${tree.size}`);
console.log(`   root            ${tree.root}  ${tree.root === pinnedRoot ? "(matches proposal)" : "(MISMATCH)"}`);

// ------------------------------------------------------------- 4. prove
console.log("\n4. generating proof (a few seconds)…");
const started = Date.now();
const ballot = await buildBallot({
  identity,
  tree,
  proposalId,
  vote,
  expectedRoot: pinnedRoot,
});
console.log(`   proof           ${(ballot.proof.length - 2) / 2} bytes in ${((Date.now() - started) / 1000).toFixed(1)}s`);
console.log(`   public inputs   root=${ballot.publicInputs[0]}`);
console.log(`                   proposal=${BigInt(ballot.publicInputs[1])}`);
console.log(`                   nullifier=${ballot.publicInputs[2]}`);
console.log(`                   vote=${BigInt(ballot.publicInputs[3])}`);
console.log(`   witness kept private: leaf index ${ballot.witness.leafIndex}, depth ${ballot.witness.depth}`);

// ------------------------------------------------- 5. submit from the relayer
if (await reader.hasRegistered(relayer.address)) {
  throw new Error(
    `relayer ${relayer.address} is a registered member wallet — the contract will reject this ` +
      "ballot, and submitting from it would deanonymise the vote anyway"
  );
}

const voting = anonVoting(deployment.anonVoting, relayer);
console.log(`\n5. submitting castVote() from relayer ${relayer.address}`);
const tx = await voting.castVote(proposalId, vote, ballot.nullifierHash, ballot.proof);
const receipt = await tx.wait();

console.log(`   tx              ${receipt.hash}`);
console.log(`   gas used        ${receipt.gasUsed}`);

const after = await reader.proposalInfo(proposalId);
console.log(`   ballots cast    ${after[3]}`);

console.log("\nwhat a chain observer learns from this transaction:");
console.log(`   • ${relayer.address} paid gas to submit a ballot on proposal ${proposalId}`);
console.log(`   • the ballot was "${vote === 1 ? "yes" : "no"}"`);
console.log(`   • nullifier ${ballot.nullifierHash} is now spent for proposal ${proposalId}`);
console.log(`   • the voter is one of the ${memberCount} commitments under root ${pinnedRoot}`);
console.log("   • nothing that narrows it further — not the leaf index, not the commitment");

rpc.destroy(); // stop the ethers poller so the script exits
