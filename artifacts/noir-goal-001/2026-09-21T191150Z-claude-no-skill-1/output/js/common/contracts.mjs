import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ethers } from "ethers";

export const ROOT_DIR = fileURLToPath(new URL("../../", import.meta.url));

export const ANON_VOTING_ABI = [
  "function register(uint256 tokenId, uint256 commitment) returns (uint256)",
  "function createProposal(bytes32 descriptionHash, uint64 votingPeriod) returns (uint256)",
  "function castVote(uint256 proposalId, bool support, uint256 nullifier, bytes proof)",
  "function getProposal(uint256) view returns (tuple(bytes32 descriptionHash, uint64 deadline, uint32 memberCount, uint32 yes, uint32 no, uint256 root, uint256 scope))",
  "function tally(uint256) view returns (uint256 yes, uint256 no, uint256 eligible)",
  "function nullifierUsed(uint256) view returns (bool)",
  "function memberCount() view returns (uint256)",
  "function proposalCount() view returns (uint256)",
  "event MemberRegistered(uint256 indexed tokenId, uint256 commitment, uint256 leafIndex, uint256 newRoot)",
  "event ProposalCreated(uint256 indexed proposalId, bytes32 descriptionHash, uint256 root, uint256 memberCount, uint64 deadline)",
  "event VoteCast(uint256 indexed proposalId, uint256 nullifier, bool support)",
  "error NotTokenOwner()", "error TokenAlreadyRegistered()", "error InvalidCommitment()", "error TreeFull()",
  "error NotMember()", "error AnonymitySetTooSmall(uint256 have, uint256 need)", "error UnknownProposal()",
  "error VotingClosed()", "error VotingStillOpen()", "error NullifierAlreadyUsed()", "error InvalidNullifier()",
  "error InvalidProof()", "error SenderIsMember()",
];

export const MEMBERSHIP_NFT_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function ownerOf(uint256) view returns (address)",
  "function nextTokenId() view returns (uint256)",
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
];

export function rpcUrl() {
  return process.env.RPC_URL ?? "http://127.0.0.1:8545";
}

/** Reads deployments/<chainId>.json written by script/Deploy.s.sol. */
export async function connect(runner = new ethers.JsonRpcProvider(rpcUrl())) {
  const provider = runner.provider ?? runner;
  const { chainId } = await provider.getNetwork();
  const dep = JSON.parse(readFileSync(`${ROOT_DIR}deployments/${chainId}.json`, "utf8"));
  return {
    provider,
    deployment: dep,
    voting: new ethers.Contract(dep.anonVoting, ANON_VOTING_ABI, runner),
    nft: new ethers.Contract(dep.membershipNFT, MEMBERSHIP_NFT_ABI, runner),
  };
}
