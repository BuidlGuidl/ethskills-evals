#!/usr/bin/env node
// End-to-end on a local chain: 150 members join, a proposal opens, some of them
// vote through a relayer, the deadline passes, anyone reads the tally.
//
//   anvil                    # terminal 1
//   ./scripts/deploy.sh
//   node scripts/demo.js     # terminal 2
//
// Env: MEMBER_COUNT (default 150), BALLOTS (default 5), RPC_URL
//
// This is the whole system exercised at once. For the single-member walkthrough
// the DAO actually ships to members, see scripts/enroll.js + scripts/vote.js.

import { keccak256, toUtf8Bytes } from "ethers";
import { commitmentOf, nullifierOf } from "./lib/member.js";
import { demoMembers, standUpCohort } from "./lib/cohort.js";
import { MemberTree } from "./lib/tree.js";
import { proveBallot } from "./lib/prove.js";
import { ANVIL_KEYS, connect, wallet } from "./lib/deployment.js";

const MEMBER_COUNT = Number(process.env.MEMBER_COUNT ?? 150);
const BALLOTS = Number(process.env.BALLOTS ?? 5);

const startedAt = Date.now();
const at = () => `[${((Date.now() - startedAt) / 1000).toFixed(1)}s]`;

const { provider, membership, memberSet, ballot, addresses } = await connect();
const admin = wallet(ANVIL_KEYS.admin, provider);

console.log(`PrivateBallot ${addresses.privateBallot}`);
console.log(`MemberSet     ${addresses.memberSet}\n`);

// ------------------------------------------------- 1. the DAO, and its members
// Deterministic demo wallets. Real members bring their own.
const members = demoMembers(MEMBER_COUNT, provider);

console.log(`${at()} ==> admin issues ${MEMBER_COUNT} seats; each member enrols their own commitment`);
const secrets = await standUpCohort({ provider, membership, memberSet, admin, members });
console.log(`${at()}     enrolled: ${await memberSet.memberCount()}`);

// Cross-check: the tree this script builds in JS, the tree Solidity built, and
// the tree the circuit will walk are all the same tree.
const onChainRoot = await memberSet.root();
const localRoot = new MemberTree(await memberSet.allLeaves()).root;
if (localRoot.toLowerCase() !== onChainRoot.toLowerCase()) throw new Error("root mismatch");
console.log(`    root:     ${onChainRoot} (JS rebuild agrees)`);

// ------------------------------------------------------------ 3. a proposal
console.log(`\n${at()} ==> member 0 opens a proposal (from their own wallet -- proposing is public)`);
const text = "Allocate 50 ETH from the treasury to the grants program";
const deadline = (await provider.getBlock("latest")).timestamp + 3 * 24 * 3600;
const created = await ballot.connect(members[0]).createProposal(keccak256(toUtf8Bytes(text)), deadline);
await created.wait();
const proposalId = (await ballot.proposalCount()) - 1n;
const proposal = await ballot.getProposal(proposalId);
const proposalTag = await ballot.proposalTag(proposalId);
console.log(`    proposal #${proposalId}: "${text}"`);
console.log(`    snapshot: ${proposal.memberCount} members, root ${proposal.memberRoot}`);

// ------------------------------------------------------------- 4. balloting
// Which members vote, and how, is chosen here only so the demo has something to
// tally. Nothing about this choice is visible on chain.
const voters = [3, 17, 42, 88, 149].slice(0, BALLOTS);
const choices = [1, 1, 0, 1, 0].slice(0, BALLOTS);

console.log(`\n${at()} ==> ${voters.length} members each build a ballot proof locally`);
const tree = new MemberTree(await memberSet.leavesAt(proposal.memberCount));
const ballots = [];
for (const [n, index] of voters.entries()) {
  const secret = secrets[index];
  const { path, bits } = tree.pathFor(tree.indexOf(commitmentOf(secret)));
  const nullifier = nullifierOf(secret, proposalTag);
  const provingStartedAt = Date.now();
  const { proof } = await proveBallot({
    root: proposal.memberRoot,
    proposalTag,
    secret,
    path,
    bits,
    vote: choices[n],
    nullifier,
  });
  ballots.push({ choice: choices[n], nullifier, proof });
  console.log(
    `    member ${String(index).padStart(3)} -> ${choices[n] ? "YES" : "NO "}  ` +
      `nullifier ${nullifier.slice(0, 12)}...  (${((Date.now() - provingStartedAt) / 1000).toFixed(1)}s)`,
  );
}

// ------------------------------------------------------------ 5. submission
// One transaction, from a wallet holding no seat, carrying everyone's ballots.
// This is what breaks the last link: not just "who signed", but "when".
const relayer = wallet(ANVIL_KEYS.submitter, provider);
console.log(`\n${at()} ==> relayer ${relayer.address} submits all ${ballots.length} in ONE transaction`);
console.log(`    relayer membership NFTs: ${await membership.balanceOf(relayer.address)}`);
const tx = await ballot.connect(relayer).castVotes(proposalId, ballots);
const receipt = await tx.wait();
console.log(`    tx ${receipt.hash}`);
console.log(`    gas ${receipt.gasUsed} for ${ballots.length} ballots`);

// A duplicate is skipped rather than reverting the batch.
const replay = await ballot.connect(relayer).castVotes(proposalId, [ballots[0]]);
await replay.wait();
console.log(`    replaying a spent ballot changed nothing (nullifier already used)`);

// ---------------------------------------------------------------- 6. tally
console.log(`\n${at()} ==> deadline passes; anyone reads the tally`);
await provider.send("evm_increaseTime", [3 * 24 * 3600 + 1]);
await provider.send("evm_mine", []);
const [yes, no, passed] = await ballot.result(proposalId);
console.log(`    ${yes} yes / ${no} no -> ${passed ? "PASSED" : "REJECTED"}`);

console.log(`
What the chain shows for proposal #${proposalId}:
  ${proposal.memberCount} enrolled members, ${Number(yes) + Number(no)} ballots, ${yes}/${no}, all delivered by
  ${relayer.address}, which holds no seat. Each ballot carries a nullifier that
  matches no commitment and no address. Any of the ${proposal.memberCount} members could have
  cast any of them.`);
