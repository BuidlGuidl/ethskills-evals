// Shared client logic: identity notes, the offchain mirror of the member tree,
// and in-process proof generation (NoirJS + bb.js — the same code runs in a browser).
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { webcrypto } from "node:crypto";
import { ethers } from "ethers";
import { poseidon2 } from "poseidon-lite";
import { IMT } from "@zk-kit/imt";
import { Noir } from "@noir-lang/noir_js";
import { Barretenberg, UltraHonkBackend } from "@aztec/bb.js";

export const ROOT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");
export const DEPTH = 10; // circuits/vote/src/main.nr and MemberRegistry.DEPTH
export const FIELD = 21888242871839275222246405745257275088548364400416417980263064491575221009009n;
export const RPC_URL = process.env.RPC_URL ?? "http://127.0.0.1:8545";

export const REGISTRY_ABI = [
  "function register(uint256 tokenId, uint256 commitment) returns (uint256)",
  "function root() view returns (uint256)",
  "function nextIndex() view returns (uint256)",
  "function tokenRegistered(uint256) view returns (bool)",
  "event MemberRegistered(uint256 indexed tokenId, uint256 commitment, uint256 leafIndex, uint256 newRoot)",
];
export const VOTING_ABI = [
  "function createProposal(uint256 tokenId, bytes32 descriptionHash, uint64 votingPeriod) returns (uint256)",
  "function castVote(uint256 proposalId, bool support, uint256 nullifierHash, bytes proof)",
  "function getProposal(uint256) view returns (tuple(bytes32 descriptionHash, uint256 root, uint256 memberCount, uint256 scope, uint64 deadline, uint32 yes, uint32 no))",
  "function proposalCount() view returns (uint256)",
  "function nullifierUsed(uint256) view returns (bool)",
  "function result(uint256) view returns (uint256 yes, uint256 no, bool passed)",
  "event ProposalCreated(uint256 indexed proposalId, bytes32 descriptionHash, uint256 root, uint256 memberCount, uint256 scope, uint64 deadline)",
  "event VoteCast(uint256 indexed proposalId, uint256 nullifierHash, bool support)",
];

export function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  if (i !== -1 && process.argv[i + 1] !== undefined) return process.argv[i + 1];
  if (fallback === undefined) throw new Error(`missing --${name}`);
  return fallback;
}

export async function loadDeployment(provider) {
  const { chainId } = await provider.getNetwork();
  const file = join(ROOT_DIR, "deployments", `${chainId}.json`);
  if (!existsSync(file)) throw new Error(`no deployment at ${file}; run the deploy script first`);
  return { chainId, ...JSON.parse(readFileSync(file, "utf8")) };
}

// ---------------------------------------------------------------- identity note

export function randomField() {
  // 64 random bytes reduced mod p: bias is negligible (< 2^-250).
  const bytes = webcrypto.getRandomValues(new Uint8Array(64));
  return BigInt(ethers.hexlify(bytes)) % FIELD;
}

/** The member's secret. Both values are random; the commitment hides them. */
export function newIdentity() {
  const identityNullifier = randomField();
  const identityTrapdoor = randomField();
  return { identityNullifier, identityTrapdoor, commitment: poseidon2([identityNullifier, identityTrapdoor]) };
}

export function notePath(chainId, registry, tokenId) {
  return join(ROOT_DIR, ".notes", `${chainId}-${registry.toLowerCase()}-token${tokenId}.json`);
}

export function saveNote(path, note) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(note, (_, v) => (typeof v === "bigint" ? v.toString() : v), 2), { mode: 0o600 });
}

export function loadNote(path) {
  const n = JSON.parse(readFileSync(path, "utf8"));
  for (const k of ["identityNullifier", "identityTrapdoor", "commitment"]) n[k] = BigInt(n[k]);
  return n;
}

// ------------------------------------------------------- offchain tree mirror

/**
 * Rebuild the member tree exactly as it was when the proposal snapshotted it,
 * by replaying MemberRegistered events (leaf order = leafIndex order).
 */
export async function rebuildMemberTree(registry, fromBlock, memberCount) {
  const logs = await registry.queryFilter(registry.filters.MemberRegistered(), fromBlock, "latest");
  const leaves = logs
    .map((l) => ({ index: Number(l.args.leafIndex), commitment: l.args.commitment, root: l.args.newRoot }))
    .sort((a, b) => a.index - b.index)
    .slice(0, Number(memberCount));
  const tree = new IMT(poseidon2, DEPTH, 0n, 2);
  for (const [i, leaf] of leaves.entries()) {
    if (leaf.index !== i) throw new Error(`missing MemberRegistered event for leaf ${i}`);
    tree.insert(leaf.commitment);
    // Poseidon consistency check against the contract, one leaf at a time.
    if (tree.root !== leaf.root) throw new Error(`offchain root diverges from onchain at leaf ${i}`);
  }
  return tree;
}

// ---------------------------------------------------------------- proving

let circuitCache;
export function loadCircuit() {
  circuitCache ??= JSON.parse(readFileSync(join(ROOT_DIR, "circuits/vote/target/vote.json"), "utf8"));
  return circuitCache;
}

const toHex32 = (x) => ethers.toBeHex(x, 32);

/**
 * Everything private stays in this function: secrets and Merkle path go into the
 * witness; only (root, scope, vote, nullifierHash) and the proof come out.
 */
export async function proveVote({ note, tree, proposal, support }) {
  const leafIndex = tree.indexOf(note.commitment);
  if (leafIndex === -1) throw new Error("your commitment is not in this proposal's member snapshot");
  const merkle = tree.createProof(leafIndex);
  const nullifierHash = poseidon2([note.identityNullifier, proposal.scope]);

  const inputs = {
    root: toHex32(proposal.root),
    scope: toHex32(proposal.scope),
    vote: support ? "0x1" : "0x0",
    nullifier_hash: toHex32(nullifierHash),
    identity_nullifier: toHex32(note.identityNullifier),
    identity_trapdoor: toHex32(note.identityTrapdoor),
    path: merkle.siblings.map((s) => toHex32(s[0])),
    indices: merkle.pathIndices.map((b) => b === 1),
  };

  const circuit = loadCircuit();
  const { witness } = await new Noir(circuit).execute(inputs);

  const api = await Barretenberg.new();
  try {
    const backend = new UltraHonkBackend(circuit.bytecode, api);
    // "evm" = keccak transcript + ZK, matching `bb write_vk --verifier_target evm`.
    const { proof, publicInputs } = await backend.generateProof(witness, { verifierTarget: "evm" });
    if (!(await backend.verifyProof({ proof, publicInputs }, { verifierTarget: "evm" }))) {
      throw new Error("local verification failed");
    }
    // Same order the contract rebuilds: root, scope, vote, nullifier_hash.
    const expected = [proposal.root, proposal.scope, support ? 1n : 0n, nullifierHash];
    publicInputs.forEach((pi, i) => {
      if (BigInt(pi) !== expected[i]) throw new Error(`public input ${i} mismatch`);
    });
    return { proof: ethers.hexlify(proof), nullifierHash };
  } finally {
    await api.destroy();
  }
}
