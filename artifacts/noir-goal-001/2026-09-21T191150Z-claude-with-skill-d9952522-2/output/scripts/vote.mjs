// Step 2 — vote. Run by the member, on their own machine. Uses NO wallet:
// the member's secret never leaves this process, and the transaction is sent by
// a relayer, so the member's publicly-known address never touches castVote.
//
//   NOTE=notes/31337-1.json PROPOSAL_ID=0 VOTE=yes RELAYER_URL=http://127.0.0.1:8787 \
//     node scripts/vote.mjs
//
// secret -> Merkle path from replayed events -> witness -> UltraHonk proof (in-process,
// NoirJS + bb.js, same code path a browser uses) -> relayer -> AnonVoting.castVote.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ethers } from "ethers";
import { poseidon2 } from "poseidon-lite";
import { Noir } from "@noir-lang/noir_js";
import { Barretenberg, UltraHonkBackend } from "@aztec/bb.js";
import { ROOT, RPC_URL, contracts, loadDeployment, toHex32 } from "./shared/common.mjs";
import { treeAtRoot } from "./shared/tree.mjs";

const note = JSON.parse(readFileSync(process.env.NOTE, "utf8"));
const proposalId = BigInt(process.env.PROPOSAL_ID ?? 0);
const support = { yes: true, no: false }[(process.env.VOTE ?? "").toLowerCase()];
if (support === undefined) throw new Error("VOTE must be yes or no");
const relayerUrl = process.env.RELAYER_URL ?? "http://127.0.0.1:8787";

// Read-only chain access. These reads reveal to the RPC provider that someone is
// looking at this proposal, not how they vote; use your own node or Tor if that matters.
const provider = new ethers.JsonRpcProvider(RPC_URL);
const dep = await loadDeployment(provider);
if (dep.registry.toLowerCase() !== note.registry.toLowerCase()) throw new Error("note is for another registry");
const { registry, voting } = contracts(dep, provider);

// 1. The proposal fixes the anonymity set (snapshot root) and the nullifier scope.
const p = await voting.getProposal(proposalId);
const now = (await provider.getBlock("latest")).timestamp;
if (now > Number(p.deadline)) throw new Error("voting closed");

// 2. Rebuild the tree as it was at the snapshot and take our Merkle path from it.
const tree = await treeAtRoot(registry, dep.startBlock, p.root);
const nullifier = BigInt(note.nullifier);
const secret = BigInt(note.secret);
const commitment = poseidon2([nullifier, secret]);
if (tree.node(0, note.leafIndex) !== commitment) {
  throw new Error("our commitment is not in this proposal's snapshot (registered after it opened, or rotated)");
}
const { siblings, indices } = tree.path(note.leafIndex);
const nullifierHash = poseidon2([nullifier, p.scope]);

// 3. Witness + proof, in-process.
const circuit = JSON.parse(readFileSync(join(ROOT, "circuits/vote/target/vote.json"), "utf8"));
const noir = new Noir(circuit);
const { witness } = await noir.execute({
  nullifier: toHex32(nullifier),
  secret: toHex32(secret),
  path_siblings: siblings.map(toHex32),
  path_indices: indices,
  root: toHex32(p.root),
  nullifier_hash: toHex32(nullifierHash),
  scope: toHex32(p.scope),
  vote: support ? "0x1" : "0x0",
});

const api = await Barretenberg.new();
try {
  const backend = new UltraHonkBackend(circuit.bytecode, api);
  console.time("prove");
  // "evm" = keccak transcript + ZK, the target the Solidity verifier was generated for.
  const { proof, publicInputs } = await backend.generateProof(witness, { verifierTarget: "evm" });
  console.timeEnd("prove");
  if (!(await backend.verifyProof({ proof, publicInputs }, { verifierTarget: "evm" }))) {
    throw new Error("local verification failed");
  }

  // Same order the contract rebuilds: root, nullifier_hash, scope, vote.
  const expected = [p.root, nullifierHash, p.scope, support ? 1n : 0n].map(toHex32);
  if (publicInputs.some((x, i) => toHex32(x) !== expected[i])) throw new Error("public input mismatch");

  // 4. Hand the proof to the relayer. It learns the vote (public anyway) and the
  // network origin of this request — route it over Tor/VPN if the relayer operator
  // is someone you don't want linking your IP to a vote.
  const res = await fetch(`${relayerUrl}/vote`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      proposalId: proposalId.toString(),
      nullifierHash: toHex32(nullifierHash),
      support,
      proof: ethers.hexlify(proof),
    }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`relayer rejected vote: ${body.error}`);
  console.log(`vote accepted by relayer: ${JSON.stringify(body)}`);
} finally {
  await api.destroy();
}
