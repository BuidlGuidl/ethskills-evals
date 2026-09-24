// Step 2 — VOTE. The member goes from their secret note to a submitted vote.
//
//   NOTE=.notes/member-1.json PROPOSAL_ID=0 SUPPORT=yes \
//   RELAYER_URL=http://127.0.0.1:8787 node scripts/vote.mjs
//
// This script holds NO private key and never signs a transaction. It only
// reads public chain data, proves locally, and hands {proof, public inputs} to
// a relayer, which submits castVote() from its own wallet. The member's NFT
// wallet therefore never appears in the vote transaction.
// (For real anonymity reach the relayer over Tor — see NOTES.md.)
import { clients, loadDeployment, requireEnv, votingAbi } from "./lib/chain.mjs";
import { loadNote, nullifierHashOf, scopeOf } from "./lib/identity.mjs";
import { merkleWitness, treeAtRoot } from "./lib/tree.mjs";
import { MAX_DEPTH, proveVote } from "./lib/prove.mjs";

const note = loadNote(requireEnv("NOTE"));
const proposalId = BigInt(requireEnv("PROPOSAL_ID"));
const support = /^(1|yes|y|true)$/i.test(requireEnv("SUPPORT"));
const relayerUrl = process.env.RELAYER_URL ?? "http://127.0.0.1:8787";

const { chainId, publicClient } = await clients();
const dep = loadDeployment(chainId);
if (chainId !== note.chainId || dep.voting.toLowerCase() !== note.voting.toLowerCase()) {
  throw new Error("note belongs to a different deployment");
}

// 1. Public proposal data: snapshot root, scope, deadline.
const p = await publicClient.readContract({
  address: dep.voting, abi: votingAbi, functionName: "getProposal", args: [proposalId],
});
const { timestamp } = await publicClient.getBlock();
if (timestamp >= p.deadline) throw new Error("voting closed");
const scope = scopeOf(chainId, dep.voting, proposalId);
if (scope !== p.scope) throw new Error("scope mismatch — wrong chain or contract");

// 2. Nullifier hash for (this member, this proposal). Deterministic, so a
// second attempt is rejected onchain; unlinkable to the commitment without the note.
// Deliberately NOT pre-checked via an RPC read: that would show the RPC provider
// this nullifier next to the member's IP. The relayer's simulation catches reuse.
const nullifierHash = nullifierHashOf(note, scope);

// 3. Rebuild the member tree as it was at the proposal's snapshot, from events.
const tree = await treeAtRoot(publicClient, dep, p.snapshotRoot);
const witness = merkleWitness(tree, note.commitment, MAX_DEPTH);
console.log(`anonymity set: ${tree.leaves.filter((l) => l !== 0n).length} registered members`);

// 4. Prove locally.
console.time("proof");
const { proof, publicInputs } = await proveVote({
  identity: note, witness, root: p.snapshotRoot, scope, nullifierHash, support,
});
console.timeEnd("proof");
const expected = [p.snapshotRoot, scope, nullifierHash, support ? 1n : 0n];
if (publicInputs.some((x, i) => x !== expected[i])) throw new Error("public input order/values mismatch");

// 5. Hand to the relayer. The payload contains nothing that identifies the member.
const res = await fetch(`${relayerUrl}/vote`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    proposalId: proposalId.toString(), support, nullifierHash: "0x" + nullifierHash.toString(16), proof,
  }),
});
const body = await res.json();
if (!res.ok) throw new Error(`relayer rejected vote: ${body.error}`);
console.log(`vote accepted by relayer; tx ${body.txHash}`);
