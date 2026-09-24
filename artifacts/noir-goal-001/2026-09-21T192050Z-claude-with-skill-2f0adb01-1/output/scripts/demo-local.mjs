// End-to-end on a local anvil chain (after scripts/deploy-local.sh):
// 3 members register, member 1 opens a proposal, members vote through a relayer
// wallet, the failure paths are exercised, time passes, anyone reads the tally.
//   anvil & bash scripts/deploy-local.sh && node scripts/demo-local.mjs
import { mnemonicToAccount } from "viem/accounts";
import { toHex } from "viem";
import { clients, loadAbi, loadDeployment, notePath, loadNote, memberTreeAtProposal } from "./lib/common.mjs";
import { register } from "./register.mjs";
import { createProposal } from "./create-proposal.mjs";
import { vote } from "./vote.mjs";
import { tally } from "./tally.mjs";
import { replaceCommitment } from "./replace-commitment.mjs";
import { proveVote } from "./lib/prove.mjs";

const MNEMONIC = "test test test test test test test test test test test junk";
const key = (i) => toHex(mnemonicToAccount(MNEMONIC, { addressIndex: i }).getHdKey().privateKey);
const RELAYER = key(9); // anvil account 9 holds no NFT and never registered

const d = loadDeployment();
const { publicClient } = clients();
const abi = loadAbi("AnonVoting");

async function expectRevert(label, fn, errorName) {
  try {
    await fn();
  } catch (e) {
    const msg = String(e.shortMessage ?? e.message) + String(e.cause?.data?.errorName ?? "") + String(e.cause?.reason ?? "");
    if (msg.includes(errorName) || JSON.stringify(e.cause?.data ?? "").includes(errorName)) {
      console.log(`  ✓ ${label} rejected (${errorName})`);
      return;
    }
    throw e;
  }
  throw new Error(`${label} unexpectedly succeeded`);
}

console.log("1. members register (member wallets, once)");
for (const i of [1, 2, 3]) await register({ memberKey: key(i), tokenId: i });

console.log("2. member 1 opens a proposal (snapshots the member tree)");
const proposalId = await createProposal({ memberKey: key(1), description: `demo proposal ${Date.now()}`, period: 3600 });

console.log("3. members vote via the relayer wallet");
await vote({ notePath: notePath(1), proposalId, support: true, relayerKey: RELAYER });
await vote({ notePath: notePath(2), proposalId, support: false, relayerKey: RELAYER });

console.log("4. failure paths");
await expectRevert("second vote by member 1", () => vote({ notePath: notePath(1), proposalId, support: false, relayerKey: RELAYER }), "already voted");
{
  // Member 3 mistakenly submits from their own NFT wallet: the contract refuses.
  const note = loadNote(notePath(3));
  const { tree } = await memberTreeAtProposal(publicClient, d, proposalId);
  const p = await publicClient.readContract({ address: d.anonVoting, abi, functionName: "getProposal", args: [proposalId] });
  const { proof, nullifierHash } = await proveVote({ note, tree, externalNullifier: p.externalNullifier, support: true });
  const { relay } = await import("./relayer.mjs");
  await expectRevert("vote sent from member's own wallet", () => relay({ proposalId, support: true, nullifierHash, proof }, key(3)), "SenderIsLinkable");
  await expectRevert("relayer flipping the vote", () => relay({ proposalId, support: false, nullifierHash, proof }, RELAYER), "InvalidProof");
  console.log("  member 3 now votes properly through the relayer");
  await relay({ proposalId, support: true, nullifierHash, proof }, RELAYER);
}

await tally(proposalId);
console.log("5. deadline passes");
await publicClient.request({ method: "evm_increaseTime", params: [3601] });
await publicClient.request({ method: "evm_mine", params: [] });
const t = await tally(proposalId);
if (!(t.yes === 2n && t.no === 1n && t.closed)) throw new Error("unexpected tally");
await expectRevert("vote after deadline", () => vote({ notePath: notePath(3), proposalId, support: true, relayerKey: RELAYER }), "voting closed");

console.log("6. a new proposal: member 4 joins, member 2 rotates their note (e.g. NFT transferred)");
await register({ memberKey: key(4), tokenId: 4 });
const stale = loadNote(notePath(2));
await replaceCommitment({ memberKey: key(2), tokenId: 2 });
const p2 = await createProposal({ memberKey: key(4), description: `second proposal ${Date.now()}`, period: 3600 });
{
  const { tree } = await memberTreeAtProposal(publicClient, d, p2);
  const p = await publicClient.readContract({ address: d.anonVoting, abi, functionName: "getProposal", args: [p2] });
  await expectRevert("replaced (old) note", () => proveVote({ note: stale, tree, externalNullifier: p.externalNullifier, support: true }), "not in the proposal snapshot");
}
await vote({ notePath: notePath(2), proposalId: p2, support: true, relayerKey: RELAYER });
await vote({ notePath: notePath(4), proposalId: p2, support: false, relayerKey: RELAYER });
await tally(p2);
console.log("demo OK");
