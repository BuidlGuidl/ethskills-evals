#!/usr/bin/env node
// STEP 2 OF 2 -- casting a ballot.  NOT sent from the member's wallet.
//
// One member, one proposal, from their secret to a mined vote transaction.
// Every step up to the last one is local: the member's wallet does not sign
// anything on chain here, and never touches the ballot transaction.
//
//   MEMBER_KEY=0x... SUBMITTER_KEY=0x... PROPOSAL_ID=0 VOTE=yes node scripts/vote.js
//
// Env:
//   MEMBER_KEY     the membership wallet. Used ONLY to re-derive the voting
//                  secret, by signing a message locally. Never broadcasts.
//   SUBMITTER_KEY  the wallet that pays gas and sends the ballot. Must NOT be a
//                  membership wallet -- see the warning below.
//   PROPOSAL_ID    which proposal
//   VOTE           yes | no
//   DRY_RUN=1      prove but do not broadcast

import { commitmentOf, deriveSecret, nullifierOf } from "./lib/member.js";
import { MemberTree } from "./lib/tree.js";
import { proveBallot } from "./lib/prove.js";
import { ANVIL_KEYS, connect, wallet } from "./lib/deployment.js";

const memberKey = process.env.MEMBER_KEY || ANVIL_KEYS.member;
const submitterKey = process.env.SUBMITTER_KEY || ANVIL_KEYS.submitter;
const proposalId = BigInt(process.env.PROPOSAL_ID ?? 0);
const voteWord = (process.env.VOTE ?? "yes").toLowerCase();
const dryRun = process.env.DRY_RUN === "1";

if (!["yes", "no"].includes(voteWord)) throw new Error(`VOTE must be yes or no, got "${voteWord}"`);
const vote = voteWord === "yes" ? 1 : 0;

const { provider, membership, memberSet, ballot } = await connect();
const member = wallet(memberKey, provider);
const submitter = wallet(submitterKey, provider);

const step = (n, text) => console.log(`\n[${n}] ${text}`);

// ---------------------------------------------------------------------------
step(1, "Re-derive the voting secret (offline, no RPC, no transaction)");
// Signing is local. The chain never sees this, and neither does anyone else.
const secret = await deriveSecret(member);
const commitment = commitmentOf(secret);
console.log(`    membership wallet  ${member.address}`);
console.log(`    commitment         ${commitment}`);

// ---------------------------------------------------------------------------
step(2, "Read the proposal and the member set it snapshotted");
const proposal = await ballot.getProposal(proposalId);
const proposalTag = await ballot.proposalTag(proposalId);
const deadline = Number(proposal.deadline);
console.log(`    proposal           #${proposalId}`);
console.log(`    description hash   ${proposal.descriptionHash}`);
console.log(`    deadline           ${new Date(deadline * 1000).toISOString()}`);
console.log(`    anonymity set      ${proposal.memberCount} enrolled members`);
console.log(`    snapshot root      ${proposal.memberRoot}`);
console.log(`    proposal tag       ${proposalTag}`);

const now = (await provider.getBlock("latest")).timestamp;
if (now > deadline) throw new Error("voting has closed on this proposal");

// ---------------------------------------------------------------------------
step(3, "Rebuild the member tree locally and find our own leaf");
// Downloading every commitment and rebuilding the tree in memory is the whole
// point: asking a server for "my Merkle path" would tell that server which leaf
// is ours, which is the one fact this system exists to protect.
const leaves = await memberSet.leavesAt(proposal.memberCount);
const tree = new MemberTree(leaves);

if (tree.root.toLowerCase() !== proposal.memberRoot.toLowerCase()) {
  throw new Error(
    `locally rebuilt root ${tree.root} does not match the on-chain snapshot ` +
      `${proposal.memberRoot}. Do not vote: the tree you were served is not the tree ` +
      `the contract will check against.`,
  );
}
console.log(`    rebuilt root       ${tree.root}  (matches on-chain)`);

const leafIndex = tree.indexOf(commitment);
if (leafIndex < 0) {
  throw new Error(
    `commitment ${commitment} is not in this proposal's snapshot.\n` +
      `Either this wallet never enrolled (run scripts/enroll.js), or it enrolled ` +
      `after proposal #${proposalId} was created, in which case it cannot vote on it.`,
  );
}
const { path, bits } = tree.pathFor(leafIndex);
console.log(`    our leaf index     ${leafIndex}  (stays on this machine)`);

// ---------------------------------------------------------------------------
step(4, "Derive the nullifier for this proposal");
// Deterministic in (secret, proposal), so the contract can refuse a second
// ballot -- and unlinkable to the commitment, so it cannot say whose it is.
const nullifier = nullifierOf(secret, proposalTag);
console.log(`    nullifier          ${nullifier}`);
if (await ballot.nullifierSpent(proposalId, nullifier)) {
  throw new Error(`this member has already voted on proposal #${proposalId}`);
}

// ---------------------------------------------------------------------------
step(5, `Prove the ballot (voting ${voteWord.toUpperCase()})`);
const startedAt = Date.now();
const { proof, publicInputs } = await proveBallot({
  root: proposal.memberRoot,
  proposalTag,
  secret,
  path,
  bits,
  vote,
  nullifier,
});
console.log(`    proved in          ${((Date.now() - startedAt) / 1000).toFixed(1)}s`);
console.log(`    proof size         ${(proof.length - 2) / 2} bytes`);
console.log(`    public inputs      root, proposalTag, nullifier, vote`);
console.log(`                       (the secret, the leaf index and the path are not among them)`);

if (dryRun) {
  console.log("\nDRY_RUN=1, stopping before broadcast.");
  process.exit(0);
}

// ---------------------------------------------------------------------------
step(6, "Submit the ballot from a wallet that is nobody in particular");
if (submitter.address.toLowerCase() === member.address.toLowerCase()) {
  throw new Error(
    "SUBMITTER_KEY is the membership wallet. Sending the ballot from there would " +
      "publish exactly what the proof is designed to hide. Use a separate, " +
      "unlinked wallet or a relayer -- see NOTES.md.",
  );
}
if ((await membership.balanceOf(submitter.address)) > 0n) {
  console.warn(
    `    WARNING: the submitter ${submitter.address} holds a membership NFT.\n` +
      `    That narrows this ballot's anonymity set to one member. Use a wallet ` +
      `that holds no seat.`,
  );
}

const tx = await ballot.connect(submitter).castVote(proposalId, vote, nullifier, proof);
console.log(`    castVote() tx      ${tx.hash}`);
console.log(`    sender             ${submitter.address}  (holds no membership NFT)`);
const receipt = await tx.wait();
console.log(`    gas used           ${receipt.gasUsed}`);

const after = await ballot.getProposal(proposalId);
console.log(`
Done. On-chain state now: ${after.yesVotes} yes / ${after.noVotes} no,
readable in full via result(${proposalId}) once the deadline passes.

What a chain observer learns from that transaction:
  - some member of the ${proposal.memberCount}-member snapshot voted ${voteWord.toUpperCase()}
  - the nullifier ${nullifier}, which is spent and cannot be reused for this proposal
  - the sender, ${submitter.address}, which holds no seat and proves nothing
What they cannot learn: which of the ${proposal.memberCount} members it was.`);
