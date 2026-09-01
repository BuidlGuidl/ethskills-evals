import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { Noir } from "@noir-lang/noir_js";
import { UltraHonkBackend, Barretenberg } from "@aztec/bb.js";
import { ROOT } from "./env.mjs";
import { toHex32 } from "./poseidon.mjs";

const CIRCUIT_PATH = join(ROOT, "circuits", "vote", "target", "vote.json");

/// Proving happens IN PROCESS, through NoirJS + bb.js — not by shelling out to
/// the `bb` CLI and reading a proof off disk. The same code path runs in a
/// member's browser, which is where it has to run: a member who uploads their
/// witness to a proving service has handed that service their vote.
///
/// `verifierTarget: "evm"` selects keccak transcripts + zero knowledge, which is
/// what `bb write_vk --verifier_target evm` produced HonkVerifier.sol from.
/// Proof, verification key and onchain verifier must all agree on this setting
/// or verification fails with no useful error.
export const VERIFIER_TARGET = "evm";

export function loadCircuit() {
  if (!existsSync(CIRCUIT_PATH)) {
    throw new Error(`no compiled circuit at ${CIRCUIT_PATH} — run "nargo compile" in circuits/vote`);
  }
  return JSON.parse(readFileSync(CIRCUIT_PATH, "utf8"));
}

/// Build the circuit's inputs. Names and order mirror `main` in
/// circuits/vote/src/main.nr exactly.
export function voteWitnessInputs({ root, proposalId, nullifierHash, vote, note, merkleProof }) {
  return {
    root: toHex32(root),
    proposal_id: toHex32(proposalId),
    nullifier_hash: toHex32(nullifierHash),
    vote: toHex32(vote),
    secret: toHex32(note.secret),
    nullifier_secret: toHex32(note.nullifierSecret),
    path_elements: merkleProof.pathElements.map(toHex32),
    path_indices: merkleProof.pathIndices,
  };
}

/// Returns { proofHex, publicInputs } ready to hand to AnonymousBallot.castVote.
/// Also self-verifies before returning: a proof that fails here would only fail
/// again onchain, after the member has already paid a relayer to broadcast it.
export async function proveVote(inputs) {
  const circuit = loadCircuit();
  const api = await Barretenberg.new();
  try {
    const noir = new Noir(circuit);
    const { witness } = await noir.execute(inputs);

    const backend = new UltraHonkBackend(circuit.bytecode, api);
    const proofData = await backend.generateProof(witness, { verifierTarget: VERIFIER_TARGET });

    const ok = await backend.verifyProof(proofData, { verifierTarget: VERIFIER_TARGET });
    if (!ok) throw new Error("locally generated proof did not verify");

    return {
      proofHex: "0x" + Buffer.from(proofData.proof).toString("hex"),
      publicInputs: proofData.publicInputs,
    };
  } finally {
    await api.destroy();
  }
}
