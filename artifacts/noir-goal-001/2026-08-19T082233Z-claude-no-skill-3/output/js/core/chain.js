import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Contract, JsonRpcProvider, Wallet } from "ethers";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../..");

export const RPC_URL = process.env.RPC_URL ?? "http://127.0.0.1:8545";

/** Well-known anvil keys, so the demo runs with no setup. */
export const ANVIL_KEYS = [
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", // 0 deployer
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d", // 1 member (token 2)
  "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a", // 2
  "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6", // 3
  "0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a", // 4
  "0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba", // 5
  "0x92db14e403b83dfe3df233f83dfa3a0d7096f21ca9b0d6d6b8d88b2b4ec1564e", // 6
  "0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356", // 7
  "0xdbda1821b80551c9d65939329250298aa3472ba22feea921c0cf5d620ea67b97", // 8
  "0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6", // 9 relayer
];

export const REGISTRY_ABI = [
  "function register(uint256 tokenId, uint256 commitment) returns (uint256 leafIndex)",
  "function root() view returns (uint256)",
  "function memberCount() view returns (uint256)",
  "function getCommitments() view returns (uint256[])",
  "function tokenRegistered(uint256) view returns (bool)",
  "function membershipNft() view returns (address)",
  "event MemberJoined(uint256 indexed leafIndex, uint256 commitment, uint256 tokenId, uint256 newRoot)",
];

export const BALLOT_ABI = [
  "function createProposal(bytes32 descriptionHash, uint64 votingPeriod) returns (uint256)",
  "function castVote(uint256 proposalId, uint256 nullifier, bool support, address submitter, bytes proof)",
  "function proposalInfo(uint256) view returns (bytes32 descriptionHash, uint256 membershipRoot, uint64 votingEnds, uint32 electorate)",
  "function proposalCount() view returns (uint256)",
  "function proposalScope(uint256) view returns (uint256)",
  "function nullifierSpent(uint256, uint256) view returns (bool)",
  "function tally(uint256) view returns (uint32 yesVotes, uint32 noVotes, uint32 electorate)",
  "event BallotCast(uint256 indexed proposalId, uint256 nullifier, bool support)",
];

export const NFT_ABI = [
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function balanceOf(address owner) view returns (uint256)",
  "function totalSupply() view returns (uint256)",
];

export function loadDeployment(chainId = 31337) {
  const path = resolve(root, `deployments/${chainId}.json`);
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    throw new Error(`no deployment at ${path} - run ./scripts/deploy-local.sh first`);
  }
}

export async function connect() {
  const provider = new JsonRpcProvider(RPC_URL);
  const { chainId } = await provider.getNetwork();
  const deployment = loadDeployment(Number(chainId));

  return {
    provider,
    deployment,
    registry: new Contract(deployment.registry, REGISTRY_ABI, provider),
    ballot: new Contract(deployment.ballot, BALLOT_ABI, provider),
    nft: new Contract(deployment.membershipNft, NFT_ABI, provider),
    wallet: (key) => new Wallet(key, provider),
  };
}

/** Minimal `--flag value` parsing, no dependency needed. */
export function parseArgs(argv = process.argv.slice(2)) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith("--")) continue;
    const key = argv[i].slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) args[key] = true;
    else args[key] = argv[++i];
  }
  return args;
}
