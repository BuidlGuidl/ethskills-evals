#!/usr/bin/env node
// Full local run against anvil after scripts/deploy-local.sh:
// 5 members register, one proposal, 5 anonymous votes via relayer, tally.
import { mkdirSync } from "node:fs";
import { ethers } from "ethers";
import { connect, rpcUrl, ROOT_DIR } from "./common/contracts.mjs";
import { createIdentity } from "./common/identity.mjs";
import { register } from "./register.mjs";
import { createProposal, readTally } from "./proposal.mjs";
import { prepareVote, submitViaRelayer } from "./vote.mjs";
import { startRelayer } from "./relayer.mjs";

const MNEMONIC = "test test test test test test test test test test test junk";
const provider = new ethers.JsonRpcProvider(rpcUrl());
const account = (i) =>
  ethers.HDNodeWallet.fromPhrase(MNEMONIC, undefined, `m/44'/60'/0'/0/${i}`).connect(provider);

const members = [1, 2, 3, 4, 5].map((i) => ({ wallet: account(i), tokenId: BigInt(i) }));
const relayerWallet = account(9);
const ballots = [true, true, false, true, false];
const demoDir = `${ROOT_DIR}.demo`;
mkdirSync(demoDir, { recursive: true });

const { voting } = await connect(provider);
const firstRun = (await voting.memberCount()) === 0n;

console.log("== 1. registration (member wallets, public) ==");
for (const [n, m] of members.entries()) {
  m.identityFile = `${demoDir}/member-${n + 1}.json`;
  if (firstRun) {
    createIdentity(m.identityFile);
    const r = await register({ memberWallet: m.wallet, identityFile: m.identityFile, tokenId: m.tokenId });
    console.log(`  ${m.wallet.address} token ${m.tokenId} -> leaf ${r.leafIndex}`);
  }
}
if (!firstRun) console.log("  (already registered on this deployment; reusing .demo identities)");

console.log("== 2. proposal ==");
const { proposalId, memberCount } = await createProposal(members[0].wallet, `demo proposal ${Date.now()}`, 3600n);
console.log(`  proposal ${proposalId}, anonymity set = ${memberCount} members`);

console.log("== 3. votes (proved locally, sent by relayer) ==");
const relayer = await startRelayer({ wallet: relayerWallet, port: 8787 });
const relayerUrl = "http://127.0.0.1:8787";
const nullifiers = [];
for (const [n, m] of members.entries()) {
  const { payload, provingMs } = await prepareVote({
    provider,
    identityFile: m.identityFile,
    proposalId,
    support: ballots[n],
  });
  const txHash = await submitViaRelayer(relayerUrl, payload);
  nullifiers.push(payload);
  const tx = await provider.getTransaction(txHash);
  console.log(`  member ${n + 1}: proof ${provingMs} ms, tx from ${tx.from} (relayer), nullifier ${payload.nullifier.slice(0, 12)}…`);
}

console.log("== 4. double vote is rejected ==");
const again = await prepareVote({ provider, identityFile: members[0].identityFile, proposalId, support: false });
if (again.payload.nullifier !== nullifiers[0].nullifier) throw new Error("nullifier not deterministic");
await submitViaRelayer(relayerUrl, again.payload).then(
  () => { throw new Error("double vote accepted!"); },
  (e) => console.log(`  ${e.message}`),
);
relayer.close();

console.log("== 5. tally ==");
try {
  await readTally(provider, proposalId);
  throw new Error("tally readable before deadline");
} catch (e) {
  console.log("  before deadline: tally() reverts (VotingStillOpen)");
}
await provider.send("evm_increaseTime", [3601]);
await provider.send("evm_mine", []);
const t = await readTally(provider, proposalId);
console.log(`  after deadline: yes ${t.yes}, no ${t.no}, eligible ${t.eligible}`);
const want = { yes: ballots.filter(Boolean).length, no: ballots.filter((b) => !b).length };
if (Number(t.yes) !== want.yes || Number(t.no) !== want.no) throw new Error("tally mismatch");
console.log("OK");
process.exit(0);
