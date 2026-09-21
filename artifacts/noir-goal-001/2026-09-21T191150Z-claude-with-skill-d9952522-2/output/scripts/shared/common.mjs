// Shared config, ABIs and field helpers for the Node scripts.
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ethers } from "ethers";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const FIELD = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
export const RPC_URL = process.env.RPC_URL ?? "http://127.0.0.1:8545";

export const REGISTRY_ABI = [
  "function register(uint256 tokenId, uint256 commitment)",
  "function root() view returns (uint256)",
  "function activeMembers() view returns (uint256)",
  "event LeafSet(uint256 indexed tokenId, uint256 indexed leafIndex, uint256 commitment, uint256 root)",
];
export const VOTING_ABI = [
  "function createProposal(bytes32 descriptionHash, uint64 deadline) returns (uint256)",
  "function castVote(uint256 proposalId, uint256 nullifierHash, bool support, bytes proof)",
  "function getProposal(uint256) view returns (tuple(bytes32 descriptionHash, uint256 root, uint256 scope, uint64 deadline, uint32 yes, uint32 no))",
  "function tally(uint256) view returns (uint256 yes, uint256 no, bool final_)",
  "event ProposalCreated(uint256 indexed proposalId, bytes32 descriptionHash, uint256 root, uint256 scope, uint64 deadline, uint256 eligibleMembers)",
  "event VoteCast(uint256 indexed proposalId, uint256 nullifierHash, bool support)",
  "error NotMember()", "error AnonymitySetTooSmall()", "error BadDeadline()", "error UnknownProposal()",
  "error VotingClosed()", "error NullifierUsed()", "error InvalidProof()",
];

export async function loadDeployment(provider) {
  const { chainId } = await provider.getNetwork();
  const file = process.env.DEPLOYMENT ?? join(ROOT, "deployments", `${chainId}.json`);
  return JSON.parse(readFileSync(file, "utf8"));
}

export function contracts(dep, runner) {
  return {
    registry: new ethers.Contract(dep.registry, REGISTRY_ABI, runner),
    voting: new ethers.Contract(dep.voting, VOTING_ABI, runner),
  };
}

/** Uniform random field element (rejection sampling, no modulo bias). */
export function randomField() {
  for (;;) {
    const x = BigInt("0x" + randomBytes(32).toString("hex")) >> 2n; // 254 bits
    if (x !== 0n && x < FIELD) return x;
  }
}

export const toHex32 = (x) => ethers.toBeHex(BigInt(x), 32);
