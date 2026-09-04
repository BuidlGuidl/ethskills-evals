import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { Noir } from "@noir-lang/noir_js";
import { Barretenberg, UltraHonkBackend } from "@aztec/bb.js";
import { toHex32 } from "./hash.js";
import { TREE_DEPTH } from "./tree.js";

const HERE = dirname(fileURLToPath(import.meta.url));
export const CIRCUIT_PATH = join(HERE, "..", "..", "circuits", "vote", "target", "vote.json");

/**
 * The verifier target must be 'evm', not 'evm-no-zk'.
 *
 * 'evm-no-zk' produces a proof the Solidity verifier accepts just as happily, but a
 * non-zero-knowledge Honk proof leaks information about the witness - and here the
 * witness *is* the member's identity. This one string is the difference between an
 * anonymous ballot and an attributable one.
 */
const VERIFIER_TARGET = "evm";

let cached = null;

async function loadBackend() {
  if (cached) return cached;
  const circuit = JSON.parse(await readFile(CIRCUIT_PATH, "utf8"));
  const api = await Barretenberg.new({ threads: 8 });
  cached = { circuit, noir: new Noir(circuit), backend: new UltraHonkBackend(circuit.bytecode, api), api };
  return cached;
}

export async function shutdownProver() {
  if (cached) {
    await cached.api.destroy();
    cached = null;
  }
}

/**
 * Build the ballot proof.
 *
 * Everything in `private` stays in this process: the secret, the leaf index (encoded
 * as path bits) and the authentication path never appear in the proof or in calldata.
 *
 * @param {object} p
 * @param {bigint} p.root        member tree root the proposal was pinned to
 * @param {bigint} p.scope       PrivateBallot.voteScope(proposalId)
 * @param {bigint} p.nullifier   identity.nullifier(scope)
 * @param {boolean} p.support    true = yes
 * @param {string} p.relayer     the address that will send the vote transaction
 * @param {bigint} p.secret      the member's secret
 * @param {boolean[]} p.pathBits leaf index, bit by bit, least significant first
 * @param {bigint[]} p.siblings  authentication path, bottom-up
 */
export async function proveBallot(p) {
  if (p.pathBits.length !== TREE_DEPTH || p.siblings.length !== TREE_DEPTH) {
    throw new Error(`merkle path must be ${TREE_DEPTH} deep`);
  }

  const { noir, backend } = await loadBackend();

  const inputs = {
    root: toHex32(p.root),
    vote_scope: toHex32(p.scope),
    nullifier: toHex32(p.nullifier),
    vote: toHex32(p.support ? 1n : 0n),
    relayer: toHex32(BigInt(p.relayer)),
    secret: toHex32(p.secret),
    path_bits: p.pathBits.map(Boolean),
    siblings: p.siblings.map(toHex32),
  };

  const { witness } = await noir.execute(inputs);
  const { proof, publicInputs } = await backend.generateProof(witness, {
    verifierTarget: VERIFIER_TARGET,
  });

  return {
    proof: "0x" + Buffer.from(proof).toString("hex"),
    publicInputs,
  };
}

/**
 * The order `PrivateBallot` rebuilds public inputs in. Kept here so a mismatch shows
 * up as a local assertion instead of an opaque `InvalidProof` revert.
 */
export function expectedPublicInputs({ root, scope, nullifier, support, relayer }) {
  return [
    toHex32(root),
    toHex32(scope),
    toHex32(nullifier),
    toHex32(support ? 1n : 0n),
    toHex32(BigInt(relayer)),
  ];
}
