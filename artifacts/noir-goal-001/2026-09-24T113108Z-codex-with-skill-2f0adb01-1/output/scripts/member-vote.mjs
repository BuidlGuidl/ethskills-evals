#!/usr/bin/env node
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Noir } from "@noir-lang/noir_js";
import { Barretenberg, UltraHonkBackend } from "@aztec/bb.js";
import { LeanIMT } from "@zk-kit/lean-imt";
import { ethers } from "ethers";
import { poseidon2 } from "poseidon-lite";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ROOT = join(__dirname, "..");
const TREE_DEPTH = 8;
const FIELD_MODULUS = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
const DOMAIN_COMMITMENT = 1n;
const DOMAIN_NULLIFIER = 2n;

const GOVERNOR_ABI = [
  "event CommitmentInserted(uint256 indexed proposalId,uint256 indexed leafIndex,uint256 commitment,uint256 root,address indexed memberWallet)",
  "function joinProposal(uint256 proposalId,uint256 commitment) external returns (uint256 leafIndex,uint256 root)",
  "function castVote(uint256 proposalId,uint256 merkleRoot,bool support,uint256 nullifierHash,bytes proof) external",
  "function proposalInfo(uint256 proposalId) external view returns (uint64 joinDeadline,uint64 voteDeadline,uint256 yesVotes,uint256 noVotes,uint256 treeSize,uint256 root)",
  "function usedNullifier(uint256 proposalId,uint256 nullifierHash) external view returns (bool)"
];

function env(name, fallback = undefined) {
  const value = process.env[name];
  if (value === undefined || value === "") {
    if (fallback !== undefined) return fallback;
    throw new Error(`Missing ${name}`);
  }
  return value;
}

function randomField() {
  while (true) {
    const value = BigInt(`0x${randomBytes(32).toString("hex")}`) % FIELD_MODULUS;
    if (value !== 0n) return value;
  }
}

function toHex(value) {
  return `0x${BigInt(value).toString(16).padStart(64, "0")}`;
}

function bytesToHex(bytes) {
  return `0x${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

function hash2(a, b) {
  return poseidon2([BigInt(a), BigInt(b)]);
}

function commitmentFromNote(nullifier, secret) {
  return hash2(DOMAIN_COMMITMENT, hash2(nullifier, secret));
}

function nullifierHashForProposal(proposalId, nullifier) {
  return hash2(hash2(DOMAIN_NULLIFIER, proposalId), nullifier);
}

async function governorAddressFromBroadcast(provider) {
  const network = await provider.getNetwork();
  const path = join(ROOT, "broadcast", "DeployLocal.s.sol", network.chainId.toString(), "run-latest.json");
  if (!existsSync(path)) return undefined;

  const broadcast = JSON.parse(readFileSync(path, "utf8"));
  const createTxs = broadcast.transactions.filter((tx) => tx.transactionType === "CREATE");
  const governorTx = createTxs.find((tx) => tx.contractName === "PrivateVoteGovernor");
  return governorTx?.contractAddress;
}

async function main() {
  const rpcUrl = env("RPC_URL", "http://127.0.0.1:8545");
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const governorAddress = env("GOVERNOR_ADDRESS", await governorAddressFromBroadcast(provider));
  const proposalId = BigInt(env("PROPOSAL_ID", "1"));
  const support = env("SUPPORT", "true").toLowerCase() !== "false";

  const defaultMemberKey = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
  const member = new ethers.Wallet(env("MEMBER_PRIVATE_KEY", defaultMemberKey), provider);
  const voter = new ethers.Wallet(env("VOTER_PRIVATE_KEY"), provider);
  const governorAsMember = new ethers.Contract(governorAddress, GOVERNOR_ABI, member);
  const governorAsVoter = new ethers.Contract(governorAddress, GOVERNOR_ABI, voter);

  const nullifier = randomField();
  const secret = randomField();
  const commitment = commitmentFromNote(nullifier, secret);

  console.log("member wallet", member.address);
  console.log("anonymous vote sender", voter.address);
  console.log("commitment", toHex(commitment));

  const joinTx = await governorAsMember.joinProposal(proposalId, commitment);
  const joinReceipt = await joinTx.wait();
  const joinEvent = joinReceipt.logs
    .map((log) => {
      try {
        return governorAsMember.interface.parseLog(log);
      } catch {
        return undefined;
      }
    })
    .find((event) => event?.name === "CommitmentInserted");

  if (!joinEvent) throw new Error("CommitmentInserted event not found");
  console.log("join tx", joinReceipt.hash);
  console.log("leaf index", joinEvent.args.leafIndex.toString());

  const filter = governorAsMember.filters.CommitmentInserted(proposalId);
  const events = await governorAsMember.queryFilter(filter, 0, "latest");
  const leaves = events.map((event) => BigInt(event.args.commitment));
  const leafIndex = leaves.findIndex((leaf) => leaf === commitment);
  if (leafIndex === -1) throw new Error("Joined commitment was not found in event replay");

  const tree = new LeanIMT(hash2, leaves);
  const merkleProof = tree.generateProof(leafIndex);
  if (merkleProof.siblings.length > TREE_DEPTH) {
    throw new Error(`Tree proof depth ${merkleProof.siblings.length} exceeds circuit depth ${TREE_DEPTH}`);
  }

  const merklePath = Array(TREE_DEPTH).fill("0x0");
  const merkleIndices = Array(TREE_DEPTH).fill(false);
  const pathExists = Array(TREE_DEPTH).fill(false);

  for (let i = 0; i < merkleProof.siblings.length; i += 1) {
    merklePath[i] = toHex(merkleProof.siblings[i]);
    merkleIndices[i] = Boolean((BigInt(merkleProof.index) >> BigInt(i)) & 1n);
    pathExists[i] = true;
  }

  const nullifierHash = nullifierHashForProposal(proposalId, nullifier);
  const circuit = JSON.parse(readFileSync(join(ROOT, "circuits", "vote", "target", "private_vote.json"), "utf8"));
  const noir = new Noir(circuit);
  const bb = await Barretenberg.new();
  const backend = new UltraHonkBackend(circuit.bytecode, bb);

  const inputs = {
    nullifier: toHex(nullifier),
    secret: toHex(secret),
    vote: support,
    merkle_path: merklePath,
    merkle_indices: merkleIndices,
    path_exists: pathExists,
    merkle_root: toHex(tree.root),
    proposal_id: toHex(proposalId),
    vote_choice: support ? "0x1" : "0x0",
    nullifier_hash: toHex(nullifierHash)
  };

  const { witness } = await noir.execute(inputs);
  const proof = await backend.generateProof(witness, { verifierTarget: "evm" });
  const proofHex = bytesToHex(proof.proof);

  const voteTx = await governorAsVoter.castVote(proposalId, tree.root, support, nullifierHash, proofHex);
  const voteReceipt = await voteTx.wait();
  console.log("vote tx", voteReceipt.hash);

  const info = await governorAsVoter.proposalInfo(proposalId);
  console.log("running tally", { yes: info.yesVotes.toString(), no: info.noVotes.toString() });

  await bb.destroy();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
