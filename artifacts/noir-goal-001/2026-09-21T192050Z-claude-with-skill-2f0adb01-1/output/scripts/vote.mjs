// One member: secret note -> ZK proof -> vote transaction sent by a relayer.
//
//   node scripts/vote.mjs --note .notes/member-1.json --proposal 0 --support yes \
//        --relayer http://127.0.0.1:8799            # POST to a relayer (normal path)
//   RELAYER_PRIVATE_KEY=0x... node scripts/vote.mjs ... # or act as the relayer yourself
//                                                      # (local demo; the key must have
//                                                      # no onchain link to the member)
//
// This script never needs, and must never be given, the member's wallet key.
import { arg, clients, isMain, loadAbi, loadDeployment, loadNote, memberTreeAtProposal } from "./lib/common.mjs";
import { proveVote } from "./lib/prove.mjs";

export async function vote({ notePath, proposalId, support, relayerUrl, relayerKey }) {
  const d = loadDeployment();
  const note = loadNote(notePath);
  if (note.chainId !== d.chainId || note.contract.toLowerCase() !== d.anonVoting.toLowerCase()) {
    throw new Error("note belongs to a different deployment");
  }
  const { publicClient } = clients();
  const abi = loadAbi("AnonVoting");

  // 1. Rebuild the member tree as of the proposal snapshot, from public events.
  const { tree, proposal } = await memberTreeAtProposal(publicClient, d, proposalId);
  const onchain = await publicClient.readContract({ address: d.anonVoting, abi, functionName: "getProposal", args: [BigInt(proposalId)] });
  if (onchain.memberRoot !== tree.root) throw new Error("snapshot root mismatch");
  if ((await publicClient.getBlock()).timestamp >= onchain.deadline) throw new Error("voting closed");
  console.log(`proposal #${proposalId}: proving membership among ${proposal.memberCount} members...`);

  // 2. Prove locally.
  const t0 = Date.now();
  const { proof, nullifierHash } = await proveVote({ note, tree, externalNullifier: onchain.externalNullifier, support });
  console.log(`proof generated in ${((Date.now() - t0) / 1000).toFixed(1)}s, ${(proof.length - 2) / 2} bytes`);

  const already = await publicClient.readContract({ address: d.anonVoting, abi, functionName: "nullifierUsed", args: [nullifierHash] });
  if (already) throw new Error("this note has already voted on this proposal");

  const payload = { proposalId: proposalId.toString(), support, nullifierHash: nullifierHash.toString(), proof };

  // 3. Hand the proof to a relayer. Nothing in the payload identifies the member.
  if (relayerUrl) {
    const res = await fetch(new URL("/vote", relayerUrl), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(`relayer: ${body.error}`);
    console.log(`relayer accepted vote, tx ${body.txHash}`);
    return body.txHash;
  }
  if (!relayerKey) throw new Error("pass --relayer <url> or set RELAYER_PRIVATE_KEY");
  const { relay } = await import("./relayer.mjs");
  const txHash = await relay(payload, relayerKey);
  console.log(`vote submitted by relayer wallet, tx ${txHash}`);
  return txHash;
}

if (isMain(import.meta.url)) {
  const s = arg("support").toLowerCase();
  if (!["yes", "no"].includes(s)) throw new Error("--support must be yes or no");
  await vote({
    notePath: arg("note"),
    proposalId: BigInt(arg("proposal")),
    support: s === "yes",
    relayerUrl: arg("relayer", process.env.RELAYER_URL ?? ""),
    relayerKey: process.env.RELAYER_PRIVATE_KEY,
  });
}
