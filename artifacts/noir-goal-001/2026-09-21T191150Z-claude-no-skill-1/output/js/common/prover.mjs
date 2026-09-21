import { readFileSync } from "node:fs";
import { Noir } from "@noir-lang/noir_js";
import { Barretenberg, UltraHonkBackend } from "@aztec/bb.js";
import { ROOT_DIR } from "./contracts.mjs";

const CIRCUIT_PATH = `${ROOT_DIR}circuits/vote/target/anon_vote.json`;

const hex32 = (x) => "0x" + BigInt(x).toString(16).padStart(64, "0");

/**
 * Runs entirely on the member's machine. The secret and Merkle path never
 * leave this function; only {proof, publicInputs} do.
 */
export async function proveVote({ secret, siblings, indices, root, scope, vote, nullifier }) {
  let circuit;
  try {
    circuit = JSON.parse(readFileSync(CIRCUIT_PATH, "utf8"));
  } catch {
    throw new Error(`missing ${CIRCUIT_PATH}; run \`npm run circuit:build\``);
  }
  const noir = new Noir(circuit);
  const { witness } = await noir.execute({
    secret: hex32(secret),
    path_siblings: siblings.map(hex32),
    path_indices: indices,
    merkle_root: hex32(root),
    scope: hex32(scope),
    vote: hex32(vote),
    nullifier: hex32(nullifier),
  });

  const api = await Barretenberg.new();
  try {
    const backend = new UltraHonkBackend(circuit.bytecode, api);
    // 'evm' = keccak transcript + zero-knowledge. The ZK variant is what makes
    // the proof reveal nothing about the witness (secret, leaf index, path);
    // never use 'evm-no-zk' here. It must match `bb write_vk -t evm`.
    const { proof, publicInputs } = await backend.generateProof(witness, { verifierTarget: "evm" });
    return { proof, publicInputs };
  } finally {
    await api.destroy();
  }
}
