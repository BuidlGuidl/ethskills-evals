// Shared client logic: notes, the offchain member-tree mirror, and proof generation.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import { ethers } from "ethers";
import { poseidon2, poseidon3 } from "poseidon-lite";
import { LeanIMT } from "@zk-kit/lean-imt";
import { Noir } from "@noir-lang/noir_js";
import { Barretenberg, UltraHonkBackend } from "@aztec/bb.js";

export const ROOT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");
export const CIRCUIT_PATH = join(ROOT_DIR, "circuits/vote/target/vote.json");

// Must equal MAX_DEPTH / LEAF_DOMAIN in circuits/vote/src/main.nr.
export const MAX_DEPTH = 16;
const LEAF_DOMAIN = 1n;
export const SNARK_FIELD = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;

export const VOTING_ABI = [
  "function register(uint256 tokenId, uint256 commitment)",
  "function createProposal(string description, uint64 votingPeriod) returns (uint256)",
  "function castVote(uint256 proposalId, uint256 vote, uint256 nullifierHash, bytes proof)",
  "function getProposal(uint256 proposalId) view returns (uint256 root, uint256 scope, uint64 deadline, uint32 eligibleVoters)",
  "function tally(uint256 proposalId) view returns (uint256 yes, uint256 no, uint256 eligibleVoters)",
  "function nullifierUsed(uint256) view returns (bool)",
  "function memberRoot() view returns (uint256)",
  "event MemberRegistered(uint256 indexed tokenId, uint256 commitment, uint256 leafIndex, uint256 root)",
  "event ProposalCreated(uint256 indexed proposalId, uint256 root, uint256 scope, uint64 deadline, uint32 eligibleVoters, string description)",
  "event VoteCast(uint256 indexed proposalId, uint256 nullifierHash, uint256 vote)",
];

export const hashPair = (a, b) => poseidon2([a, b]); // == Noir hash_2 == PoseidonT3.hash

export function loadDeployment(chainId) {
  return JSON.parse(readFileSync(join(ROOT_DIR, "deployments", `${chainId}.json`), "utf8"));
}

// ------------------------------------------------------------------ notes

const randomField = () => BigInt("0x" + randomBytes(32).toString("hex")) % SNARK_FIELD;

/// The member's only secret. `nullifier` and `secret` are both random 254-bit field
/// elements, so the public commitment can't be brute-forced. Losing this file means
/// the member can never vote again with this registration.
export function newNote() {
  const nullifier = randomField();
  const secret = randomField();
  return { nullifier, secret, commitment: commitmentOf(nullifier, secret) };
}

export const commitmentOf = (nullifier, secret) => poseidon3([nullifier, secret, LEAF_DOMAIN]);

export function saveNote(path, note) {
  mkdirSync(dirname(path), { recursive: true });
  const ser = Object.fromEntries(Object.entries(note).map(([k, v]) => [k, typeof v === "bigint" ? v.toString() : v]));
  writeFileSync(path, JSON.stringify(ser, null, 2), { mode: 0o600 });
}

export function loadNote(path) {
  const raw = JSON.parse(readFileSync(path, "utf8"));
  const note = { ...raw, nullifier: BigInt(raw.nullifier), secret: BigInt(raw.secret), commitment: BigInt(raw.commitment) };
  if (commitmentOf(note.nullifier, note.secret) !== note.commitment) throw new Error("note is corrupt");
  return note;
}

// ------------------------------------------------------------------ tree mirror

/// Rebuild the member tree from MemberRegistered events. Pulls the *whole* log
/// (never a filter on the member's own tokenId/commitment), so the RPC provider
/// learns nothing about which member is asking.
export async function fetchCommitments(voting, fromBlock = 0) {
  const logs = await voting.queryFilter(voting.filters.MemberRegistered(), fromBlock, "latest");
  return logs
    .map((l) => ({ commitment: l.args.commitment, leafIndex: Number(l.args.leafIndex), root: l.args.root }))
    .sort((a, b) => a.leafIndex - b.leafIndex);
}

/// Tree as it stood when the proposal snapshotted it: its first `eligibleVoters` leaves.
export function snapshotTree(events, eligibleVoters, expectedRoot) {
  events.forEach((e, i) => {
    if (e.leafIndex !== i) throw new Error(`missing registration event at leaf ${i}`);
  });
  const tree = new LeanIMT(hashPair, events.slice(0, eligibleVoters).map((e) => e.commitment));
  if (tree.root !== expectedRoot) throw new Error("offchain tree root does not match the proposal snapshot");
  // Also cross-check each emitted root against the mirror, catching hash mismatches early.
  const check = new LeanIMT(hashPair);
  for (const e of events) {
    check.insert(e.commitment);
    if (check.root !== e.root) throw new Error(`root mismatch after leaf ${e.leafIndex}`);
  }
  return tree;
}

// ------------------------------------------------------------------ proving

const toHex = (x) => "0x" + x.toString(16).padStart(64, "0");

export function scopeOf(chainId, votingAddress, proposalId) {
  const enc = ethers.AbiCoder.defaultAbiCoder().encode(["uint256", "address", "uint256"], [chainId, votingAddress, proposalId]);
  return BigInt(ethers.keccak256(enc)) % SNARK_FIELD;
}

/// Build the witness and an EVM-targeted UltraHonk proof, in-process (same code path
/// a browser client uses; no `bb` CLI).
export async function proveVote({ note, tree, scope, vote }) {
  const leafIndex = tree.indexOf(note.commitment);
  if (leafIndex < 0) throw new Error("this note is not in the proposal's member snapshot");
  const mp = tree.generateProof(leafIndex);
  // LeanIMT proofs omit levels with no sibling; `mp.index` packs one direction bit per sibling.
  const pathIndices = Array.from({ length: MAX_DEPTH }, (_, i) => i < mp.siblings.length && ((mp.index >> i) & 1) === 1);
  const siblings = Array.from({ length: MAX_DEPTH }, (_, i) => toHex(mp.siblings[i] ?? 0n));
  const nullifierHash = hashPair(note.nullifier, scope);

  const inputs = {
    nullifier: toHex(note.nullifier),
    secret: toHex(note.secret),
    path_length: mp.siblings.length,
    path_indices: pathIndices,
    siblings,
    root: toHex(tree.root),
    scope: toHex(scope),
    vote: toHex(BigInt(vote)),
    nullifier_hash: toHex(nullifierHash),
  };

  const circuit = JSON.parse(readFileSync(CIRCUIT_PATH, "utf8"));
  const noir = new Noir(circuit);
  const { witness } = await noir.execute(inputs);

  const api = await Barretenberg.new();
  try {
    const backend = new UltraHonkBackend(circuit.bytecode, api);
    const { proof, publicInputs } = await backend.generateProof(witness, { verifierTarget: "evm" });
    if (!(await backend.verifyProof({ proof, publicInputs }, { verifierTarget: "evm" }))) {
      throw new Error("local proof verification failed");
    }
    // Order = circuit pub params = AnonymousVoting._publicInputs: root, scope, vote, nullifier_hash.
    const expected = [tree.root, scope, BigInt(vote), nullifierHash];
    if (publicInputs.length !== 4 || publicInputs.some((p, i) => BigInt(p) !== expected[i])) {
      throw new Error("public inputs out of order");
    }
    return { proof: ethers.hexlify(proof), nullifierHash };
  } finally {
    await api.destroy();
  }
}
