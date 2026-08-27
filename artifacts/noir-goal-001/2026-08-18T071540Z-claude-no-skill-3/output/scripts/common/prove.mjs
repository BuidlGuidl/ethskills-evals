// Proof generation: witness -> Prover.toml -> nargo execute -> bb prove.
//
// This runs entirely on the member's own machine. Nothing here touches the
// network, and the secret never leaves this process.
//
// In a browser dApp you would swap these CLI calls for @noir-lang/noir_js +
// @aztec/bb.js, which run the same circuit and the same prover in WASM. The
// inputs, the public input ordering and the resulting proof bytes are identical.

import { execFileSync } from "node:child_process";
import { writeFileSync, readFileSync, rmSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { toBeHex } from "ethers";
import { CIRCUIT_DIR } from "./deployment.mjs";

/**
 * Proving target. `evm` means keccak transcript + zero-knowledge, which is what
 * the generated Solidity verifier expects.
 *
 * The ZK part is not optional here: with `evm-no-zk` the proof would not hide
 * its witness, and the witness is the member's secret and Merkle path.
 */
const VERIFIER_TARGET = "evm";

const field = (v) => toBeHex(BigInt(v), 32);

function run(cmd, args, cwd) {
  try {
    return execFileSync(cmd, args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch (err) {
    const detail = [err.stdout, err.stderr].filter(Boolean).join("\n").trim();
    throw new Error(`${cmd} ${args.join(" ")} failed:\n${detail || err.message}`);
  }
}

/**
 * Build an UltraHonk proof that the holder of `secret` is in the member tree
 * and is casting `vote` on `proposalId`.
 *
 * @returns {{proof: string, publicInputs: string[], nullifier: bigint}}
 */
export function generateVoteProof({ root, proposalId, nullifier, vote, secret, path, leafIndex }) {
  if (vote !== 0n && vote !== 1n) throw new Error("vote must be 0n or 1n");

  // A per-call name so concurrent provers cannot clobber each other's files.
  const tag = `vote_${process.pid}_${leafIndex}_${proposalId}`;
  const proverName = tag;
  const proverPath = resolve(CIRCUIT_DIR, `${proverName}.toml`);
  const witnessName = tag;
  const witnessPath = resolve(CIRCUIT_DIR, "target", `${witnessName}.gz`);
  const proofDir = resolve(CIRCUIT_DIR, "target", tag);

  const toml = [
    `root = "${field(root)}"`,
    `proposal_id = "${field(proposalId)}"`,
    `nullifier = "${field(nullifier)}"`,
    `vote = "${field(vote)}"`,
    `secret = "${field(secret)}"`,
    `path = [${path.map((p) => `"${field(p)}"`).join(", ")}]`,
    `leaf_index = "${leafIndex}"`,
    "",
  ].join("\n");

  try {
    writeFileSync(proverPath, toml);
    mkdirSync(proofDir, { recursive: true });

    // Compile once; cheap and a no-op if target/vote.json is current.
    run("nargo", ["compile"], CIRCUIT_DIR);
    run("nargo", ["execute", "--prover-name", proverName, witnessName], CIRCUIT_DIR);

    const bytecode = resolve(CIRCUIT_DIR, "target", "vote.json");
    const vk = resolve(CIRCUIT_DIR, "target", "vk", "vk");
    run(
      "bb",
      // prettier-ignore
      ["prove", "-b", bytecode, "-w", witnessPath, "-k", vk,
       "-o", proofDir, "-t", VERIFIER_TARGET],
      CIRCUIT_DIR,
    );

    const proof = "0x" + readFileSync(resolve(proofDir, "proof")).toString("hex");
    const publicInputsRaw = readFileSync(resolve(proofDir, "public_inputs"));

    // Sanity: the prover must have committed to exactly what we are about to
    // send on-chain. A mismatch here means the contract call would revert.
    const publicInputs = [];
    for (let i = 0; i < publicInputsRaw.length; i += 32) {
      publicInputs.push("0x" + publicInputsRaw.subarray(i, i + 32).toString("hex"));
    }
    const expected = [field(root), field(proposalId), field(nullifier), field(vote)];
    if (publicInputs.length !== 4 || publicInputs.some((v, i) => v !== expected[i])) {
      throw new Error(
        `public inputs from bb do not match the intended vote:\n` +
          `  expected ${expected.join(", ")}\n  got      ${publicInputs.join(", ")}`,
      );
    }

    return { proof, publicInputs };
  } finally {
    rmSync(proverPath, { force: true });
    rmSync(witnessPath, { force: true });
    rmSync(proofDir, { recursive: true, force: true });
  }
}

/** Regenerate the verification key (needed once, and after any circuit change). */
export function ensureVerificationKey() {
  run("nargo", ["compile"], CIRCUIT_DIR);
  run(
    "bb",
    ["write_vk", "-b", "target/vote.json", "-o", "target/vk", "-t", VERIFIER_TARGET],
    CIRCUIT_DIR,
  );
}
