import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { hexlify, toBeHex } from "ethers";
import { Barretenberg, UltraHonkBackend } from "@aztec/bb.js";
import { Noir } from "@noir-lang/noir_js";

const here = dirname(fileURLToPath(import.meta.url));

export const CIRCUIT_PATH = resolve(here, "../../circuits/vote/target/vote.json");

export function loadCircuit(path = CIRCUIT_PATH) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new Error(`could not read the compiled circuit at ${path}\n` + `run: (cd circuits/vote && nargo compile)`);
  }
}

/**
 * Turn a member's secret plus their Merkle path into a proof the ballot
 * contract will accept.
 *
 * Everything here happens on the member's own machine. Note which values are
 * public (they end up in the transaction) and which are witness-only.
 */
export async function generateVoteProof({
  membershipRoot,
  proposalScope,
  nullifier,
  support,
  submitter,
  secret,
  leafIndex,
  siblings,
  circuit = loadCircuit(),
}) {
  const inputs = {
    // public
    membership_root: toBeHex(BigInt(membershipRoot), 32),
    proposal_scope: toBeHex(BigInt(proposalScope), 32),
    nullifier: toBeHex(BigInt(nullifier), 32),
    support: toBeHex(support ? 1n : 0n, 32),
    submitter: toBeHex(BigInt(submitter), 32),
    // private - these never leave this process
    secret: toBeHex(BigInt(secret), 32),
    leaf_index: Number(leafIndex),
    siblings: siblings.map((s) => toBeHex(BigInt(s), 32)),
  };

  const noir = new Noir(circuit);
  const { witness } = await noir.execute(inputs);

  const api = await Barretenberg.new();
  try {
    const backend = new UltraHonkBackend(circuit.bytecode, api);
    // 'evm' = keccak transcript + ZK, which is what the generated
    // HonkVerifier.sol was written for.
    const { proof, publicInputs } = await backend.generateProof(witness, { verifierTarget: "evm" });
    return { proof: hexlify(proof), publicInputs };
  } finally {
    await api.destroy();
  }
}
