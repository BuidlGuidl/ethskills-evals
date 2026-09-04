#!/usr/bin/env node
//
// End-to-end walk through one contested proposal on a local chain.
//
//   anvil &                       # or: scripts/deploy-local.sh does both
//   ./scripts/deploy-local.sh
//   node js/demo.js
//
// Prints, at each step, which wallet signed and what a chain observer sees.
import { ethers } from "ethers";
import { connect, decodeRevert, fundLocally, loadSecret, memberWallet, relayerWallet } from "./core/chain.js";
import { randomSecret } from "./core/identity.js";
import { join } from "./join.js";
import { buildBallot, vote } from "./vote.js";
import { parseArgs } from "./core/args.js";

const args = parseArgs();
const JOINERS = Number(args.joiners ?? 12); // >= Ballot.minAnonymitySet
const VOTING_PERIOD = 3600;

const rule = (title) => console.log(`\n${"=".repeat(72)}\n${title}\n${"=".repeat(72)}`);

const chain = await connect();
const { provider, ballot, registry } = chain;

rule(`1. ${JOINERS} members join the anonymity set (each from their own NFT wallet)`);
for (let i = 0; i < JOINERS; i++) {
  const r = await join({ memberIndex: i, fund: true });
  if (r.alreadyJoined) console.log(`  member ${String(i).padStart(3)} already joined (${r.commitment.slice(0, 12)}…)`);
  else console.log(`  member ${String(i).padStart(3)} ${r.address} -> leaf ${r.index}  commitment ${r.commitment.slice(0, 12)}…  gas ${r.gasUsed}`);
}
console.log(`  registry root : ${await registry.root()}  over ${await registry.memberCount()} members`);

rule("2. A member opens a proposal (public act, ordinary DAO business)");
const proposer = memberWallet(0, provider);
await fundLocally(provider, proposer.address, "10");
const descriptionHash = ethers.keccak256(ethers.toUtf8Bytes("Fund the grants program with 200 ETH?"));
const createTx = await ballot.connect(proposer).createProposal(descriptionHash, VOTING_PERIOD);
const createReceipt = await createTx.wait();
const proposalId = Number((await ballot.proposalCount()) - 1n);
const [root, memberCount, deadline] = await ballot.proposalInfo(proposalId);
console.log(`  sender        : ${proposer.address}  (member 0, publicly identifiable)`);
console.log(`  proposal id   : ${proposalId}`);
console.log(`  snapshot root : ${root}  over ${memberCount} members`);
console.log(`  deadline      : ${new Date(Number(deadline) * 1000).toISOString()}`);
console.log(`  gas           : ${createReceipt.gasUsed}`);

rule("3. Three members vote, each relayed by an unrelated wallet");
const ballots = [
  { member: 3, support: true, relayer: 0 },
  { member: 5, support: false, relayer: 1 },
  { member: 9, support: true, relayer: 2 },
];
let firstBallot;
for (const b of ballots) {
  const r = await vote({ memberIndex: b.member, proposalId, support: b.support, relayerIndex: b.relayer, fund: true });
  firstBallot ??= r;
  console.log(`  member ${b.member} votes ${b.support ? "YES" : "NO "} | sender ${r.relayer} | nullifier ${r.nullifier.slice(0, 12)}… | gas ${r.gasUsed}`);
  console.log(`      (member's own wallet ${r.memberAddress} sent nothing; leaf index ${r.leafIndex} never left the machine)`);
}

rule("4. The same member tries to vote again");
try {
  await vote({ memberIndex: 3, proposalId, support: false, relayerIndex: 3, fund: true });
  console.log("  !! double vote accepted — this is a bug");
} catch (err) {
  console.log(`  refused before wasting a proof: ${String(err.message).split("\n")[0]}`);
}
// And if they skip the client check and push the same ballot straight at the
// contract, the nullifier is already spent.
const stubborn = relayerWallet(4, provider);
await fundLocally(provider, stubborn.address, "10");
try {
  await (await ballot.connect(stubborn).castVote(proposalId, true, firstBallot.nullifier, firstBallot.proof)).wait();
  console.log("  !! replayed ballot accepted — this is a bug");
} catch (err) {
  console.log(`  rejected on chain: ${decodeRevert(ballot, err)}`);
}

rule("5. Someone who never joined tries to vote");
try {
  await buildBallot({ chain, secret: randomSecret(), proposalId, support: true });
  console.log("  !! outsider accepted — this is a bug");
} catch (err) {
  console.log(`  rejected offline: ${String(err.message).split("\n")[0]}`);
}

rule("6. A relayer tries to flip the ballot it was handed");
const honest = await buildBallot({ chain, secret: loadSecret(chain.chainId, "member-7"), proposalId, support: true });
const crooked = relayerWallet(9, provider);
await fundLocally(provider, crooked.address, "10");
try {
  // Same proof, same nullifier, opposite vote. `vote` is a public input, so
  // the verifier is checking a statement the member never signed off on.
  await (await ballot.connect(crooked).castVote(proposalId, false, honest.nullifier, honest.proof)).wait();
  console.log("  !! flipped ballot accepted — this is a bug");
} catch (err) {
  console.log(`  rejected on chain: ${decodeRevert(ballot, err)}`);
}
console.log("  (member 7's honest ballot is simply not cast, to keep the tally below tidy)");

rule("7. Reading the tally after the deadline");
try {
  await ballot.tally(proposalId);
  console.log("  !! tally readable while voting is open — this is a bug");
} catch {
  console.log("  before the deadline: tally() reverts with VotingStillOpen");
}
await provider.send("evm_increaseTime", [VOTING_PERIOD + 1]);
await provider.send("evm_mine", []);
const [yes, no] = await ballot.tally(proposalId);
console.log(`  after the deadline : ${yes} yes / ${no} no`);

rule("8. What a chain observer can reconstruct");
const joined = await registry.queryFilter(registry.filters.Joined());
const cast = await ballot.queryFilter(ballot.filters.VoteCast(proposalId));
console.log(`  Joined events   : ${joined.length}  -> which member wallets are in the anonymity set, and at which leaf`);
console.log(`  VoteCast events : ${cast.length}  -> the ballots, and nothing that ties them to a leaf:`);
for (const ev of cast) {
  const tx = await provider.getTransaction(ev.transactionHash);
  console.log(`      from ${tx.from}  support=${ev.args.support}  nullifier ${ev.args.nullifier.slice(0, 12)}…`);
}
const senders = new Set((await Promise.all(cast.map((e) => provider.getTransaction(e.transactionHash)))).map((t) => t.from));
const memberWallets = new Set(joined.map((_, i) => memberWallet(i, provider).address));
const overlap = [...senders].filter((s) => memberWallets.has(s));
console.log(`  ballot senders that are also member wallets: ${overlap.length} (must be 0)`);
console.log(`  which member cast which ballot: not derivable from any of the above`);
