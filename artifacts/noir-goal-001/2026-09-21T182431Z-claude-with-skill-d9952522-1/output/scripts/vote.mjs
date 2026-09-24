// Step 2 (per proposal): from the identity note to a submitted vote.
// Needs NO wallet key: it only reads the chain, proves locally, and hands the
// proof to a relayer, whose wallet sends the transaction.
//
//   node scripts/vote.mjs --note .notes/<file>.json --proposal 0 --vote yes [--relayer http://127.0.0.1:8787]
import { ethers } from "ethers";
import { RPC_URL, REGISTRY_ABI, VOTING_ABI, arg, loadDeployment, loadNote, proveVote, rebuildMemberTree } from "./lib.mjs";

const note = loadNote(arg("note"));
const proposalId = BigInt(arg("proposal"));
const support = { yes: true, no: false }[arg("vote")];
if (support === undefined) throw new Error("--vote must be yes or no");
const relayerUrl = arg("relayer", process.env.RELAYER_URL ?? "http://127.0.0.1:8787");

const provider = new ethers.JsonRpcProvider(RPC_URL);
const dep = await loadDeployment(provider);
const registry = new ethers.Contract(dep.registry, REGISTRY_ABI, provider);
const voting = new ethers.Contract(dep.voting, VOTING_ABI, provider);

// 1. Proposal parameters: the snapshotted root, its leaf count, and the scope.
const p = await voting.getProposal(proposalId);
const proposal = { root: p.root, scope: p.scope, memberCount: p.memberCount };
if (BigInt((await provider.getBlock("latest")).timestamp) >= p.deadline) throw new Error("voting closed");

// 2. Rebuild the member tree as of the snapshot from events; it must hit the same root.
const tree = await rebuildMemberTree(registry, dep.deployBlock, proposal.memberCount);
if (tree.root !== proposal.root) throw new Error("rebuilt tree does not match proposal root");

// 3. Prove membership + vote + nullifier, in-process.
console.log(`proving vote on proposal ${proposalId} (anonymity set: ${proposal.memberCount})...`);
const t0 = Date.now();
const { proof, nullifierHash } = await proveVote({ note, tree, proposal, support });
console.log(`proof generated in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

if (await voting.nullifierUsed(nullifierHash)) throw new Error("already voted on this proposal");

// 4. Hand it to the relayer. The payload holds nothing tying it to the member;
//    in production send it over Tor / a mixnet so the relayer does not see your IP.
const res = await fetch(`${relayerUrl}/vote`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ proposalId: proposalId.toString(), support, nullifierHash: nullifierHash.toString(), proof }),
});
const body = await res.json();
if (!res.ok) throw new Error(`relayer rejected: ${body.error}`);
console.log(`vote submitted by relayer: tx ${body.txHash}`);
