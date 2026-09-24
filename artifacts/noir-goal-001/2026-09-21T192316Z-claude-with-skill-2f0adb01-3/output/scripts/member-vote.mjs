// A member goes from their secret note to a submitted, unattributable ballot.
// Run by the member, locally — the secret never leaves this process.
//
//   NOTE=notes/member-7.json PROPOSAL_ID=1 VOTE=yes \
//   RELAYER_URL=http://127.0.0.1:8788 node scripts/member-vote.mjs
//
// Submission (pick one):
//   RELAYER_URL          POST the proof to a relayer; the relayer's wallet sends
//                        castVote. Recommended; reach it over Tor/VPN so the
//                        relayer can't see your IP.
//   SENDER_PRIVATE_KEY   send castVote yourself from a wallet with NO onchain link
//                        to your member wallet (not funded by it, never
//                        interacted with it). The script refuses the member
//                        wallet and any wallet holding a membership NFT.
//
// Nothing here is sent from, signed by, or references the member's NFT wallet.
import { readFileSync } from "node:fs";
import { Noir } from "@noir-lang/noir_js";
import { Barretenberg, UltraHonkBackend } from "@aztec/bb.js";
import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  CIRCUIT_PATH, RPC_URL, connect, votingAbi, erc721Abi,
  proposalNullifier, rebuildSnapshotTree, merkleInputs, toBytes32, bytesToHex,
} from "./lib/common.mjs";

const notePath = process.env.NOTE;
const proposalId = BigInt(process.env.PROPOSAL_ID ?? "");
const voteArg = (process.env.VOTE ?? "").toLowerCase();
if (!notePath) throw new Error("set NOTE to your secret note file");
if (!["yes", "no"].includes(voteArg)) throw new Error("set VOTE=yes or VOTE=no");
const support = voteArg === "yes";

const note = JSON.parse(readFileSync(notePath, "utf8"));
const idNullifier = BigInt(note.idNullifier);
const idTrapdoor = BigInt(note.idTrapdoor);

const { chain, chainId, deployment, publicClient } = await connect();
if (note.chainId !== chainId || note.voting.toLowerCase() !== deployment.voting.toLowerCase()) {
  throw new Error("note belongs to a different chain / deployment");
}

// 1. Public proposal data: the snapshot root/size we must prove against, and
//    the contract-derived scope that makes our nullifier proposal-specific.
const [, snapshotRoot, snapshotSize, scope, deadline] = await publicClient.readContract({
  address: deployment.voting, abi: votingAbi, functionName: "getProposal", args: [proposalId],
});
const now = (await publicClient.getBlock()).timestamp;
if (now >= deadline) throw new Error("voting on this proposal has closed");

// 2. Nullifier for (me, this proposal). Deterministic: a second ballot from
//    this note would reuse it and be rejected onchain.
//    Deliberately NOT pre-checked with an eth_call to nullifierUsed(): that
//    would show the RPC operator this machine's IP next to the nullifier that
//    later appears in the public ballot — i.e. who voted what. Every read this
//    script makes is identical for all members; double votes are rejected by
//    the relayer's simulation / the contract instead.
const nullifierHash = proposalNullifier(idNullifier, scope);

// 3. Rebuild the snapshot tree from public events; locate our leaf by value.
const tree = await rebuildSnapshotTree(publicClient, deployment, snapshotSize, snapshotRoot);
const leafIndex = tree.indexOf(BigInt(note.commitment));
if (leafIndex < 0) throw new Error("not in this proposal's snapshot (registered after it was created?)");

// 4. Witness + ZK proof. Input names/order follow circuits/vote/src/main.nr.
const circuit = JSON.parse(readFileSync(CIRCUIT_PATH, "utf8"));
const inputs = {
  identity_nullifier: idNullifier.toString(),
  identity_trapdoor: idTrapdoor.toString(),
  ...merkleInputs(tree, leafIndex),
  merkle_root: snapshotRoot.toString(),
  scope: scope.toString(),
  vote: support ? "1" : "0",
  nullifier_hash: nullifierHash.toString(),
};

console.log(`proving ballot for proposal ${proposalId} (anonymity set: ${snapshotSize} members)...`);
const t0 = Date.now();
const api = await Barretenberg.new();
let proofHex, publicInputs;
try {
  const { witness } = await new Noir(circuit).execute(inputs);
  const backend = new UltraHonkBackend(circuit.bytecode, api);
  // 'evm' = keccak transcript + zero-knowledge; matches `bb ... -t evm` used
  // to generate HonkVerifier.sol. Never use a *-no-zk target for ballots.
  const proof = await backend.generateProof(witness, { verifierTarget: "evm" });
  if (!(await backend.verifyProof(proof, { verifierTarget: "evm" }))) throw new Error("local verify failed");
  proofHex = bytesToHex(proof.proof);
  publicInputs = proof.publicInputs.map(toBytes32);
} finally {
  await api.destroy();
}
console.log(`proof generated in ${((Date.now() - t0) / 1000).toFixed(1)}s (${(proofHex.length - 2) / 2} bytes)`);

// Serialization boundary: must equal AnonymousVoting._publicInputs().
const expected = [snapshotRoot, scope, support ? 1n : 0n, nullifierHash].map(toBytes32);
if (JSON.stringify(publicInputs) !== JSON.stringify(expected)) {
  throw new Error(`public input mismatch:\n${publicInputs}\n${expected}`);
}

// 5. Submit. The ballot payload carries no identity: proposal, vote, nullifier, proof.
const ballot = { proposalId: proposalId.toString(), support, nullifierHash: toBytes32(nullifierHash), proof: proofHex };

if (process.env.RELAYER_URL) {
  const res = await fetch(new URL("/vote", process.env.RELAYER_URL), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(ballot),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`relayer rejected ballot: ${body.error}`);
  console.log(`relayer submitted castVote: tx ${body.txHash}`);
} else if (process.env.SENDER_PRIVATE_KEY) {
  const sender = privateKeyToAccount(process.env.SENDER_PRIVATE_KEY);
  if (sender.address.toLowerCase() === note.memberAddress?.toLowerCase()) {
    throw new Error("refusing to send the ballot from your member wallet — that would sign your vote with your name");
  }
  const nft = await publicClient.readContract({ address: deployment.voting, abi: votingAbi, functionName: "membership" });
  if ((await publicClient.readContract({ address: nft, abi: erc721Abi, functionName: "balanceOf", args: [sender.address] })) > 0n) {
    throw new Error("refusing to send from a wallet that holds a membership NFT");
  }
  const wallet = createWalletClient({ account: sender, chain, transport: http(RPC_URL) });
  const { request } = await publicClient.simulateContract({
    account: sender, address: deployment.voting, abi: votingAbi, functionName: "castVote",
    args: [proposalId, support, ballot.nullifierHash, proofHex],
  });
  const hash = await wallet.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error(`castVote reverted: ${hash}`);
  console.log(`castVote sent from unlinked wallet ${sender.address}: tx ${hash}`);
} else {
  throw new Error("set RELAYER_URL or SENDER_PRIVATE_KEY");
}
