// Step 2 (no member wallet involved): secret note -> ZK proof -> relayer -> castVote.
//
//   NOTE=notes/me.json PROPOSAL_ID=0 VOTE=yes RELAYER_URL=http://127.0.0.1:8787 node scripts/vote.mjs
//
// Only reads the chain (the full registration log and the proposal) and talks to a
// relayer. There is deliberately no private key here: the vote transaction is signed
// by the relayer, never by the wallet that registered.
import { ethers } from "ethers";
import { VOTING_ABI, fetchCommitments, loadDeployment, loadNote, proveVote, scopeOf, snapshotTree } from "./lib.mjs";

const rpc = process.env.RPC_URL ?? "http://127.0.0.1:8545";
const relayerUrl = process.env.RELAYER_URL ?? "http://127.0.0.1:8787";
const proposalId = BigInt(process.env.PROPOSAL_ID ?? "0");
const voteArg = (process.env.VOTE ?? "").toLowerCase();
if (!["yes", "no"].includes(voteArg)) throw new Error("set VOTE=yes or VOTE=no");
const vote = voteArg === "yes" ? 1 : 0;

const note = loadNote(process.env.NOTE ?? "notes/note.json");
const provider = new ethers.JsonRpcProvider(rpc);
const { chainId } = await provider.getNetwork();
const votingAddr = loadDeployment(chainId).voting;
const voting = new ethers.Contract(votingAddr, VOTING_ABI, provider);

// 1. Proposal snapshot: the root (= anonymity set) this vote must prove against.
const p = await voting.getProposal(proposalId);
if (BigInt((await provider.getBlock("latest")).timestamp) > p.deadline) throw new Error("voting closed");
const scope = scopeOf(chainId, votingAddr, proposalId);
if (scope !== p.scope) throw new Error("scope mismatch");

// 2. Rebuild the member tree from events and check it against the snapshot root.
const tree = snapshotTree(await fetchCommitments(voting), Number(p.eligibleVoters), p.root);
console.log(`anonymity set: ${p.eligibleVoters} members`);

// 3. Prove in-process.
const t0 = Date.now();
const { proof, nullifierHash } = await proveVote({ note, tree, scope, vote });
console.log(`proof generated in ${Date.now() - t0} ms (${(proof.length - 2) / 2} bytes)`);
if (await voting.nullifierUsed(nullifierHash)) throw new Error("this note already voted on this proposal");

// 4. Hand it to the relayer, which signs and pays for castVote.
const res = await fetch(`${relayerUrl}/vote`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ proposalId: proposalId.toString(), vote, nullifierHash: nullifierHash.toString(), proof }),
});
const out = await res.json();
if (!res.ok) throw new Error(`relayer rejected vote: ${out.error}`);
console.log(`vote relayed in tx ${out.txHash} (gas ${out.gasUsed})`);
