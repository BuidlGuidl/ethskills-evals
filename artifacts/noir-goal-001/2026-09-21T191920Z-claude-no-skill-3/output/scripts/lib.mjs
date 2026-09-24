// Shared helpers for the member-side scripts: deployment loading, identity derivation,
// registry-tree reconstruction and proof generation.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { ethers } from "ethers";
import { poseidon1, poseidon2 } from "poseidon-lite";

export const FIELD = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
export const TREE_DEPTH = 10; // circuits/vote TREE_DEPTH == VoterRegistry.DEPTH

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// Build output of `nargo compile` (scripts/build-circuit.sh).
export const CIRCUIT_PATH = path.join(ROOT, "circuits/vote/target/vote.json");

export const ABI = {
  nft: ["function balanceOf(address) view returns (uint256)", "function ownerOf(uint256) view returns (address)"],
  registry: [
    "function register(uint256 tokenId, uint256 commitment)",
    "function evict(uint256 tokenId)",
    "function root() view returns (uint256)",
    "function activeMembers() view returns (uint256)",
    "function registrations(uint256) view returns (uint32 leafIndexPlusOne, address registrant)",
    "event LeafSet(uint256 indexed tokenId, uint256 indexed leafIndex, uint256 commitment, uint256 newRoot)",
  ],
  voting: [
    "function createProposal(bytes32 contentHash, uint64 deadline) returns (uint256)",
    "function castVote(uint256 id, bool support, uint256 nullifier, bytes proof)",
    "function proposals(uint256) view returns (bytes32 contentHash, uint256 root, uint64 deadline, uint32 electorate, uint32 yes, uint32 no)",
    "function scopeOf(uint256) view returns (uint256)",
    "function tally(uint256) view returns (uint256 yes, uint256 no, uint256 electorate)",
    "function proposalCount() view returns (uint256)",
    "event ProposalCreated(uint256 indexed id, bytes32 contentHash, uint256 root, uint64 deadline, uint256 electorate)",
    "event VoteCast(uint256 indexed id, uint256 nullifier, bool support)",
    "error UnknownProposal()",
    "error VotingClosed()",
    "error VotingOpen()",
    "error AlreadyVoted()",
    "error InvalidNullifier()",
    "error InvalidProof()",
  ],
};

export function env(name, fallback) {
  const v = process.env[name];
  if (v === undefined || v === "") {
    if (fallback === undefined) throw new Error(`missing env ${name}`);
    return fallback;
  }
  return v;
}

export async function connect() {
  const provider = new ethers.JsonRpcProvider(env("RPC_URL", "http://127.0.0.1:8545"));
  const { chainId } = await provider.getNetwork();
  const dep = JSON.parse(readFileSync(path.join(ROOT, "deployments", `${chainId}.json`), "utf8"));
  return {
    provider,
    dep,
    nft: new ethers.Contract(dep.nft, ABI.nft, provider),
    registry: new ethers.Contract(dep.registry, ABI.registry, provider),
    voting: new ethers.Contract(dep.voting, ABI.voting, provider),
  };
}

// ------------------------------------------------------------------ identity

/// The identity secret. Either supplied directly (IDENTITY_SECRET) or derived from a
/// signature by the member's NFT wallet over a fixed, domain-separated message, so it can
/// be re-derived from the wallet and never has to be backed up separately. Signing is
/// local and offchain. Bump KEY_VERSION to rotate to a fresh identity.
export async function loadSecret({ dep, memberWallet }) {
  if (process.env.IDENTITY_SECRET) return BigInt(process.env.IDENTITY_SECRET) % FIELD;
  if (!memberWallet) throw new Error("set IDENTITY_SECRET or MEMBER_PRIVATE_KEY");
  const message = [
    "DAO anonymous voting identity",
    `chainId: ${dep.chainId}`,
    `registry: ${ethers.getAddress(dep.registry)}`,
    `keyVersion: ${env("KEY_VERSION", "0")}`,
    "",
    "Only sign this inside the DAO voting client. Anyone holding this signature can vote as you.",
  ].join("\n");
  const sig = await memberWallet.signMessage(message);
  const secret = BigInt(ethers.keccak256(sig)) % FIELD;
  if (secret === 0n) throw new Error("degenerate secret; bump KEY_VERSION");
  return secret;
}

export const commitmentOf = (secret) => poseidon1([secret]);
export const nullifierOf = (secret, scope) => poseidon2([secret, scope]);

// ------------------------------------------------------------------ registry tree

/// Rebuild the registry tree exactly as it was when proposal `id` snapshotted its root.
/// Downloads *every* LeafSet event (not just ours), so the RPC endpoint learns nothing
/// about which leaf we are.
export async function snapshotTree({ provider, dep, registry, voting }, id) {
  const [created] = await voting.queryFilter(voting.filters.ProposalCreated(id), dep.deployBlock);
  if (!created) throw new Error(`proposal ${id} not found`);
  const events = await registry.queryFilter(registry.filters.LeafSet(), dep.deployBlock, created.blockNumber);
  const before = (e) =>
    e.blockNumber < created.blockNumber || (e.blockNumber === created.blockNumber && e.index < created.index);

  const leaves = [];
  for (const e of events.filter(before).sort((a, b) => a.blockNumber - b.blockNumber || a.index - b.index)) {
    leaves[Number(e.args.leafIndex)] = e.args.commitment;
  }
  for (let i = 0; i < leaves.length; i++) leaves[i] ??= 0n;

  const layers = [leaves.slice()];
  let zero = 0n;
  for (let level = 0; level < TREE_DEPTH; level++) {
    const cur = layers[level];
    const next = [];
    for (let i = 0; i < cur.length; i += 2) next.push(poseidon2([cur[i], cur[i + 1] ?? zero]));
    layers.push(next);
    zero = poseidon2([zero, zero]);
  }
  const root = layers[TREE_DEPTH][0] ?? zero;
  if (root !== created.args.root) throw new Error("rebuilt tree does not match proposal snapshot root");
  return { leaves, layers, root };
}

export function merklePath({ leaves, layers }, commitment) {
  const index = leaves.findIndex((l) => l === commitment);
  if (index < 0) return null;
  const siblings = [];
  let zero = 0n;
  let i = index;
  for (let level = 0; level < TREE_DEPTH; level++) {
    siblings.push(layers[level][i ^ 1] ?? zero);
    zero = poseidon2([zero, zero]);
    i >>= 1;
  }
  return { index, siblings };
}

// ------------------------------------------------------------------ proving

/// Runs entirely locally: the secret and the Merkle path never leave this process.
export async function proveVote({ secret, index, siblings, root, scope, support }) {
  const { Noir } = await import("@noir-lang/noir_js");
  const { Barretenberg, UltraHonkBackend } = await import("@aztec/bb.js");
  const circuit = JSON.parse(readFileSync(CIRCUIT_PATH, "utf8"));
  const nullifier = nullifierOf(secret, scope);
  const noir = new Noir(circuit);
  const { witness } = await noir.execute({
    secret: secret.toString(),
    leaf_index: index.toString(),
    siblings: siblings.map(String),
    root: root.toString(),
    scope: scope.toString(),
    vote: support ? "1" : "0",
    nullifier: nullifier.toString(),
  });
  const api = await Barretenberg.new();
  try {
    const backend = new UltraHonkBackend(circuit.bytecode, api);
    // "evm" = keccak transcript + zero-knowledge, matching HonkVerifier.sol.
    const proofData = await backend.generateProof(witness, { verifierTarget: "evm" });
    if (!(await backend.verifyProof(proofData, { verifierTarget: "evm" }))) throw new Error("local verify failed");
    return { nullifier, proof: ethers.hexlify(proofData.proof), publicInputs: proofData.publicInputs };
  } finally {
    await api.destroy();
  }
}
