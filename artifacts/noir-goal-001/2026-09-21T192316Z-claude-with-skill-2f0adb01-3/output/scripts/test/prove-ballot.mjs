// FFI helper for contracts/test/AnonymousVoting.t.sol. Not part of the member flow.
//   node scripts/test/prove-ballot.mjs <memberCount> <memberIndex> <scope> <vote 0|1>
// Members use deterministic test identities (nullifier = 1000*i+1, trapdoor = 1000*i+2),
// mirrored in the Solidity test. Prints abi.encode(bytes32 nullifierHash, bytes proof).
import { readFileSync } from "node:fs";
import { Noir } from "@noir-lang/noir_js";
import { Barretenberg, UltraHonkBackend } from "@aztec/bb.js";
import { LeanIMT } from "@zk-kit/lean-imt";
import { poseidon2 } from "poseidon-lite";
import { encodeAbiParameters } from "viem";
import { CIRCUIT_PATH, identityCommitment, proposalNullifier, merkleInputs, toBytes32, bytesToHex } from "../lib/common.mjs";

// bb.js logs progress via console.log; keep stdout clean for the ABI-encoded result.
console.log = (...a) => console.error(...a);

const [count, index, scope, vote] = process.argv.slice(2).map(BigInt);
const id = (i) => ({ n: 1000n * i + 1n, t: 1000n * i + 2n });

const tree = new LeanIMT((a, b) => poseidon2([a, b]));
for (let i = 0n; i < count; i++) tree.insert(identityCommitment(id(i).n, id(i).t));

const me = id(index);
const nullifierHash = proposalNullifier(me.n, scope);
const circuit = JSON.parse(readFileSync(CIRCUIT_PATH, "utf8"));
const { witness } = await new Noir(circuit).execute({
  identity_nullifier: me.n.toString(),
  identity_trapdoor: me.t.toString(),
  ...merkleInputs(tree, Number(index)),
  merkle_root: tree.root.toString(),
  scope: scope.toString(),
  vote: vote.toString(),
  nullifier_hash: nullifierHash.toString(),
});
const api = await Barretenberg.new();
const proof = await new UltraHonkBackend(circuit.bytecode, api).generateProof(witness, { verifierTarget: "evm" });
await api.destroy();
process.stdout.write(
  encodeAbiParameters([{ type: "bytes32" }, { type: "bytes" }], [toBytes32(nullifierHash), bytesToHex(proof.proof)]),
);
