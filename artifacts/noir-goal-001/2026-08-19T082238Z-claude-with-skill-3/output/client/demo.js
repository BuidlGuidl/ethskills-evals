#!/usr/bin/env node
// End-to-end run against a local anvil, in the order NOTES.md describes.
//
//   anvil
//   npm run deploy:local
//   node client/demo.js                 # 150 members, 7 of them vote
//   node client/demo.js --members 20 --voters 3
//
// Prints, for every onchain transaction, which wallet sent it -- because that is the
// part that decides whether the votes are actually anonymous.

import { getContract, parseEther } from "viem";
import { args } from "./src/args.js";
import { vote } from "./vote.js";
import { createIdentity, loadNote, saveNote } from "./src/identity.js";
import { shutdownProver } from "./src/prove.js";
import {
  abiOf,
  loadDeployment,
  publicClient,
  walletFor,
  anvilAccount,
  relayerAccount,
  waitFor,
} from "./src/chain.js";

const a = args();
const MEMBERS = Number(a.members ?? 150);
const VOTERS = Number(a.voters ?? 7);
const VOTING_PERIOD = 3600n;

const deployment = loadDeployment();
const pub = publicClient();

const admin = anvilAccount(0); // deployed the contracts, mints the NFTs
const relayer = relayerAccount();

// Member i uses mnemonic index i+100, well clear of the deployer and the relayer.
const memberAccount = (i) => anvilAccount(i + 100);

const nftAbi = abiOf("MembershipNFT");
const ballotAbi = abiOf("AnonymousBallot");
const registryAbi = abiOf("MemberRegistry");

const section = (n, s) => console.log(`\n${"=".repeat(72)}\n${n}. ${s}\n${"=".repeat(72)}`);

// ---------------------------------------------------------------------------------
section(0, "Fund the demo wallets (anvil only)");
// Anvil funds 10 accounts; the 150 members and the relayer need balances too.
for (let i = 0; i < MEMBERS; i++) {
  await pub.request({
    method: "anvil_setBalance",
    params: [memberAccount(i).address, "0x" + parseEther("10").toString(16)],
  });
}
await pub.request({
  method: "anvil_setBalance",
  params: [relayer.address, "0x" + parseEther("100").toString(16)],
});
console.log(`funded ${MEMBERS} member wallets and the relayer ${relayer.address}`);

// ---------------------------------------------------------------------------------
section(1, "Issue membership NFTs");
// Stand-in for the DAO's existing collection. Sender: the DAO admin. Public by design.
const nft = getContract({
  address: deployment.membershipNFT,
  abi: nftAbi,
  client: { public: pub, wallet: walletFor(admin) },
});
const alreadyMinted = Number(await nft.read.totalSupply());
if (alreadyMinted < MEMBERS) {
  const recipients = [];
  for (let i = alreadyMinted; i < MEMBERS; i++) recipients.push(memberAccount(i).address);
  // Chunked so the calldata stays under a sane size.
  for (let i = 0; i < recipients.length; i += 50) {
    await waitFor(await nft.write.mintBatch([recipients.slice(i, i + 50)]), pub);
  }
}
console.log(`sender: admin ${admin.address}`);
console.log(`membership NFTs outstanding: ${await nft.read.totalSupply()}`);

// ---------------------------------------------------------------------------------
section(2, "Every member registers a commitment (one tx each, from their own wallet)");
console.log("observer learns: <known member wallet> -> <a commitment>. No vote exists yet.");
// Demo-only shortcut: the members' registration transactions are fired off together
// instead of one at a time, purely so a 150-member run finishes quickly. Each is still
// a separate transaction from that member's own wallet, exactly as client/register.js
// does it for a single member -- that script is the real, readable version of this.
const notes = [];
const registry = getContract({ address: deployment.registry, abi: registryAbi, client: pub });

const fresh = [];
for (let i = 0; i < MEMBERS; i++) {
  const notePath = `client/notes/member-${i}.json`;
  const existing = loadNote(notePath);
  if (existing?.leafIndex !== null && existing?.registry === deployment.registry) {
    notes.push(existing);
  } else {
    notes.push(null);
    fresh.push({ i, notePath, identity: await createIdentity() });
  }
}

let lastHash;
for (const m of fresh) {
  // Distinct accounts, so these can be in flight at once without nonce conflicts.
  lastHash = await walletFor(memberAccount(m.i)).writeContract({
    address: deployment.registry,
    abi: registryAbi,
    functionName: "register",
    args: [BigInt(m.i), m.identity.commitment],
  });
}
if (lastHash) await waitFor(lastHash, pub);

// Leaf indices come from the events, the same source client/vote.js replays later.
const registrationEvents = await pub.getContractEvents({
  address: deployment.registry,
  abi: registryAbi,
  eventName: "MemberRegistered",
  fromBlock: 0n,
  toBlock: "latest",
});
const leafOf = new Map(
  registrationEvents.map((e) => [e.args.commitment, Number(e.args.leafIndex)]),
);
for (const m of fresh) {
  const leafIndex = leafOf.get(m.identity.commitment);
  if (leafIndex === undefined) throw new Error(`member ${m.i} registration did not land`);
  const note = {
    ...m.identity,
    leafIndex,
    registry: deployment.registry,
    chainId: deployment.chainId,
  };
  saveNote(m.notePath, note);
  notes[m.i] = note;
  if (m.i < 3 || m.i === MEMBERS - 1) {
    console.log(`  member ${m.i}: ${memberAccount(m.i).address} -> leaf ${leafIndex}`);
  } else if (m.i === 3) {
    console.log(`  ... ${MEMBERS - 4} more ...`);
  }
}
console.log(`registry: ${await registry.read.memberCount()} members, root 0x${(await registry.read.root()).toString(16)}`);

// ---------------------------------------------------------------------------------
section(3, "Open a proposal (freezes the anonymity set)");
const ballotWrite = getContract({
  address: deployment.ballot,
  abi: ballotAbi,
  client: { public: pub, wallet: walletFor(memberAccount(0)) },
});
const proposalId = Number(await pub.readContract({
  address: deployment.ballot, abi: ballotAbi, functionName: "proposalCount",
}));
await waitFor(
  await ballotWrite.write.createProposal([
    0n,
    "Increase the treasury grant budget to 400 ETH",
    VOTING_PERIOD,
  ]),
  pub,
);
const ballot = getContract({ address: deployment.ballot, abi: ballotAbi, client: pub });
const [, root, snapshotCount, votingEnds] = await ballot.read.proposals([BigInt(proposalId)]);
console.log(`sender: member 0 ${memberAccount(0).address} (a public, attributable act)`);
console.log(`proposal ${proposalId}: root 0x${root.toString(16)}`);
console.log(`  anonymity set ${snapshotCount} members, closes at unix ${votingEnds}`);

// ---------------------------------------------------------------------------------
section(4, `${VOTERS} members vote, each relayed`);
console.log(`relayer: ${relayer.address} sends every one of these\n`);
const casts = [];
for (let i = 0; i < VOTERS; i++) {
  // Arbitrary spread of members and choices, to show the tally is not the voter list.
  const memberIndex = (i * 17 + 5) % MEMBERS;
  const support = i % 3 !== 0;
  const r = await vote({
    proposalId,
    support,
    note: notes[memberIndex],
    deployment,
    relayer,
    log: () => {},
  });
  casts.push({ memberIndex, ...r });
  console.log(
    `  member ${String(memberIndex).padStart(3)} voted ${support ? "YES" : "NO "}  ` +
      `| tx from ${r.relayer} | nullifier 0x${r.nullifier.toString(16).slice(0, 12)}...`,
  );
}
console.log(
  "\nthe member indices above exist only in this script's memory; the chain saw " +
    `${VOTERS} identical-looking calls from one relayer.`,
);

// ---------------------------------------------------------------------------------
section(5, "Replaying a proof is rejected onchain");
// Anyone watching the mempool can copy a proof verbatim. Resubmitting it -- the
// strongest replay an observer can mount -- is caught by the spent nullifier.
const replay = casts[0];
try {
  await walletFor(relayer).writeContract({
    address: deployment.ballot,
    abi: ballotAbi,
    functionName: "castVote",
    args: [BigInt(proposalId), replay.nullifier, replay.support, replay.proof],
  });
  console.log("!! replay went through -- this is a bug");
  process.exitCode = 1;
} catch (e) {
  const reason = /NullifierAlreadySpent/.test(String(e)) ? "NullifierAlreadySpent" : String(e).split("\n")[0];
  console.log(`relayer resubmitted an identical proof: reverted (${reason})`);
}

// ---------------------------------------------------------------------------------
section(6, "Deadline passes, anyone reads the tally");
await pub.request({ method: "evm_increaseTime", params: ["0x" + (VOTING_PERIOD + 1n).toString(16)] });
await pub.request({ method: "evm_mine", params: [] });
const [yes, no, turnout, anonymitySet] = await ballot.read.result([BigInt(proposalId)]);
console.log(`yes ${yes} / no ${no}  (turnout ${turnout} of ${anonymitySet})`);

const expectedYes = casts.filter((c) => c.support).length;
const expectedNo = casts.length - expectedYes;
if (Number(yes) !== expectedYes || Number(no) !== expectedNo) {
  console.log(`!! expected ${expectedYes}/${expectedNo} -- tally is wrong`);
  process.exitCode = 1;
} else {
  console.log("tally matches what the demo cast. Which member cast which is not recoverable.");
}

await shutdownProver();
