// Proof generation, in-process.
//
// Everything here runs unchanged in a browser: NoirJS executes the circuit to a
// witness and bb.js's UltraHonkBackend proves it in WASM. Nothing shells out to the
// `bb` CLI and nothing reads a proof off disk, because the member's secret must never
// leave their machine and the real client is a web page, not a laptop with nargo on it.
//
// `verifierTarget: 'evm'` must match how the verification key behind
// contracts/src/HonkVerifier.sol was written (`bb write_vk --verifier_target evm`).
// The default serialization will not verify onchain.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Noir } from "@noir-lang/noir_js";
import { UltraHonkBackend, Barretenberg } from "@aztec/bb.js";
import { ROOT, toHex32 } from "./chain.js";

const CIRCUIT_PATH = join(ROOT, "circuits", "vote", "target", "vote.json");

let cached;

async function load() {
  if (!cached) {
    let circuit;
    try {
      circuit = JSON.parse(readFileSync(CIRCUIT_PATH, "utf8"));
    } catch {
      throw new Error(`missing ${CIRCUIT_PATH} -- run \`npm run circuit:build\` first`);
    }
    const api = await Barretenberg.new();
    cached = {
      circuit,
      noir: new Noir(circuit),
      backend: new UltraHonkBackend(circuit.bytecode, api),
      api,
    };
  }
  return cached;
}

/** Free the WASM backend so the process can exit. */
export async function shutdownProver() {
  if (cached) {
    await cached.api.destroy();
    cached = undefined;
  }
}

/**
 * Prove one vote.
 *
 * Public inputs, in this order (the contract rebuilds the identical array):
 *   [root, proposalId, nullifierHash, vote]
 * Private inputs never leave this function.
 */
export async function proveVote({
  root,
  proposalId,
  nullifierHash,
  support, // boolean
  secret,
  trapdoor,
  siblings,
  pathIndices,
}) {
  const { noir, backend } = await load();

  const inputs = {
    root: toHex32(root),
    proposal_id: toHex32(proposalId),
    nullifier_hash: toHex32(nullifierHash),
    vote: toHex32(support ? 1 : 0),
    identity_secret: toHex32(secret),
    identity_trapdoor: toHex32(trapdoor),
    path_indices: pathIndices.map(Boolean),
    siblings: siblings.map(toHex32),
  };

  // Fails here, locally, if the witness is unsatisfiable -- e.g. a stale Merkle path.
  const { witness } = await noir.execute(inputs);
  const { proof, publicInputs } = await backend.generateProof(witness, {
    verifierTarget: "evm",
  });

  const expected = [
    toHex32(root),
    toHex32(proposalId),
    toHex32(nullifierHash),
    toHex32(support ? 1 : 0),
  ];
  const got = publicInputs.map((x) => toHex32(x));
  if (got.length !== expected.length || got.some((x, i) => x !== expected[i])) {
    throw new Error(
      `public input mismatch:\n  backend: ${got.join(", ")}\n  expected: ${expected.join(", ")}`,
    );
  }

  return {
    proof: ("0x" + Buffer.from(proof).toString("hex")),
    publicInputs: got,
  };
}
