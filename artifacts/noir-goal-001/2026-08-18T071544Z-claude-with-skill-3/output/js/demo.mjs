#!/usr/bin/env node
// End-to-end walkthrough against a local chain: eight members join, one proposal
// opens, five members vote through a relayer, the abuse paths are shown failing,
// and the tally is read after the deadline.
//
//   anvil
//   cd contracts && forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 --broadcast
//   node js/demo.mjs           # add --rpc <url> or RPC_URL=<url> for another chain
//
// Every ballot below is a real Noir proof verified by the deployed HonkVerifier.

import { HDNodeWallet, Mnemonic, Wallet } from "ethers";
import { identityFromSigner, nullifierHashFor } from "./lib/identity.mjs";
import { buildMemberTree } from "./lib/tree.mjs";
import { Prover } from "./lib/prove.mjs";
import { anonVoting, membership, loadDeployment, provider } from "./lib/contracts.mjs";
import { parseArgs } from "./lib/args.mjs";

const args = parseArgs();
const rpc = provider(args.rpc);
const deployment = await loadDeployment();

const mnemonic = Mnemonic.fromPhrase("test test test test test test test test test test test junk");
const anvil = (i) => new Wallet(HDNodeWallet.fromMnemonic(mnemonic, `m/44'/60'/0'/0/${i}`).privateKey, rpc);

const MEMBER_COUNT = Number(deployment.memberCount ?? 8);
const members = Array.from({ length: MEMBER_COUNT }, (_, i) => anvil(i + 1));
const relayer = anvil(9); // holds no NFT, never registered

const reader = anonVoting(deployment.anonVoting, rpc);
const nft = membership(deployment.membershipNFT, rpc);

const line = (title) => console.log(`\n${"─".repeat(72)}\n${title}\n${"─".repeat(72)}`);

// ------------------------------------------------------------ 1. registration
line("1. members join the vote (each from their own NFT wallet)");

const identities = [];
for (const member of members) {
  if ((await nft.balanceOf(member.address)) === 0n) throw new Error(`${member.address} holds no membership NFT`);
  const identity = await identityFromSigner(member);
  identities.push(identity);

  if (await reader.hasRegistered(member.address)) continue;
  const tx = await anonVoting(deployment.anonVoting, member).register(identity.commitment);
  await tx.wait();
}
console.log(`registered commitments: ${await reader.memberCount()}`);
console.log(`current member root   : ${await reader.currentRoot()}`);

// -------------------------------------------------------------- 2. a proposal
line("2. a member opens a proposal");

const VOTING_PERIOD = 3600;
const proposer = anonVoting(deployment.anonVoting, members[0]);
const createTx = await proposer.createProposal("Fund the Q3 grants round", VOTING_PERIOD);
const createReceipt = await createTx.wait();
const proposalId = Number(await reader.proposalCount()) - 1;
const [pinnedRoot, setSize, deadline] = await reader.proposalInfo(proposalId);

console.log(`proposal #${proposalId} opened by ${members[0].address}`);
console.log(`pinned root  : ${pinnedRoot}`);
console.log(`anonymity set: ${setSize} members`);
console.log(`deadline     : ${new Date(Number(deadline) * 1000).toISOString()}`);

// ------------------------------------------------------------------ 3. voting
line("3. five members vote — every ballot relayed by the same burner wallet");

const { tree } = await buildMemberTree(reader, deployment.deployBlock ?? 0, createReceipt.blockNumber);
if (tree.root !== pinnedRoot) throw new Error("offchain tree root does not match the pinned root");

// One Barretenberg instance for every ballot below — spinning it up per proof
// dominates the runtime otherwise.
const prover = await Prover.create();

const plan = [
  { member: 0, vote: 1 },
  { member: 3, vote: 1 },
  { member: 4, vote: 0 },
  { member: 6, vote: 1 },
  { member: 7, vote: 0 },
];

const relayed = anonVoting(deployment.anonVoting, relayer);
const spent = [];
for (const { member, vote } of plan) {
  const ballot = await prover.ballot({ identity: identities[member], tree, proposalId, vote, expectedRoot: pinnedRoot });
  const tx = await relayed.castVote(proposalId, vote, ballot.nullifierHash, ballot.proof);
  const receipt = await tx.wait();
  spent.push({ member, vote, nullifierHash: ballot.nullifierHash, hash: receipt.hash });
  console.log(`  ballot "${vote === 1 ? "yes" : "no "}"  tx ${receipt.hash}  gas ${receipt.gasUsed}`);
}

console.log("\nwhat the chain now shows, ballot by ballot:");
for (const b of spent) {
  console.log(`  from ${relayer.address}  vote=${b.vote}  nullifier=${b.nullifierHash}`);
}
console.log("(the member column exists only inside this script's memory — it is nowhere onchain)");

// ------------------------------------------------------------- 4. abuse paths
line("4. the things that must not work");

const expectFailure = async (label, fn) => {
  try {
    await fn();
    console.log(`  ✗ ${label} — SUCCEEDED, which is a bug`);
    process.exitCode = 1;
  } catch (error) {
    // ethers decodes our custom errors into error.revert; fall back to the message
    // for the offline failures (e.g. "not in the member tree"), which never reach the chain.
    const reason = error.revert?.name ?? error.shortMessage ?? error.message;
    console.log(`  ✓ ${label} — rejected (${reason.split("\n")[0].slice(0, 90)})`);
  }
};

const doubleVoter = plan[0].member;
await expectFailure("same member votes twice on this proposal", async () => {
  const ballot = await prover.ballot({
    identity: identities[doubleVoter],
    tree,
    proposalId,
    vote: 0,
    expectedRoot: pinnedRoot,
  });
  await relayed.castVote.staticCall(proposalId, 0, ballot.nullifierHash, ballot.proof);
});

// Members 1, 2 and 5 have not voted yet, so these two cases fail on their own
// merits rather than tripping the spent-nullifier check first.
await expectFailure("member submits their own ballot from their NFT wallet", async () => {
  const ballot = await prover.ballot({
    identity: identities[1],
    tree,
    proposalId,
    vote: 1,
    expectedRoot: pinnedRoot,
  });
  await anonVoting(deployment.anonVoting, members[1]).castVote.staticCall(
    proposalId,
    1,
    ballot.nullifierHash,
    ballot.proof
  );
});

await expectFailure("relayer flips a ballot from yes to no", async () => {
  const ballot = await prover.ballot({
    identity: identities[2],
    tree,
    proposalId,
    vote: 1,
    expectedRoot: pinnedRoot,
  });
  await relayed.castVote.staticCall(proposalId, 0, ballot.nullifierHash, ballot.proof);
});

await expectFailure("non-member with a made-up secret tries to vote", async () => {
  const outsider = await identityFromSigner(anvil(0)); // deployer, never registered
  await prover.ballot({ identity: outsider, tree, proposalId, vote: 1, expectedRoot: pinnedRoot });
});

// -------------------------------------------------------------- 5. the tally
line("5. the tally, after the deadline");

await expectFailure("reading the result before the deadline", () => reader.result(proposalId));

await rpc.send("evm_increaseTime", [VOTING_PERIOD + 1]);
await rpc.send("evm_mine", []);

const [yesVotes, noVotes] = await reader.result(proposalId);
console.log(`\n  yes ${yesVotes} / no ${noVotes}  (turnout ${yesVotes + noVotes} of ${setSize})`);

// Cross-check: nullifiers are spent, but none of them points at a member.
const anyLinkable = await Promise.all(
  identities.map(async (identity) => reader.nullifierSpent(nullifierHashFor(identity.identityNullifier, proposalId)))
);
console.log(
  `\n  note: this script can tell who voted (${anyLinkable.filter(Boolean).length} of ${MEMBER_COUNT}) only because it holds every member's secret.`
);
console.log("  a chain observer holds none of them and can compute none of these nullifiers.");

await prover.close();

rpc.destroy(); // stop the ethers poller so the script exits
