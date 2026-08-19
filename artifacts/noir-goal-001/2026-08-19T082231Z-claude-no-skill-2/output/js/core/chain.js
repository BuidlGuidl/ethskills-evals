import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { Contract, JsonRpcProvider, Wallet } from "ethers";

const HERE = dirname(fileURLToPath(import.meta.url));
export const ROOT = join(HERE, "..", "..");

export const DEFAULT_RPC = process.env.RPC_URL ?? "http://127.0.0.1:8545";

/** anvil's default mnemonic, accounts 0..9. Local chain only, obviously. */
export const ANVIL_KEYS = [
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
  "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
  "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6",
  "0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a",
  "0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba",
  "0x92db14e403b83dfe3df233f83dfa3a0d7096f21ca9b0d6d6b8d88b2b4ec1564e",
  "0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356",
  "0xdbda1821b80551c9d65939329250298aa3472ba22feea921c0cf5d620ea67b97",
  "0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6",
];

/** ABIs come straight out of the Foundry build so they cannot drift from the source. */
export async function abiOf(contractName) {
  const path = join(ROOT, "out", `${contractName}.sol`, `${contractName}.json`);
  try {
    return JSON.parse(await readFile(path, "utf8")).abi;
  } catch (err) {
    throw new Error(`missing artifact ${path} - run \`forge build\` first (${err.message})`);
  }
}

export async function loadDeployment(path = process.env.DEPLOYMENT ?? join(ROOT, "deployments", "local.json")) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (err) {
    throw new Error(`missing ${path} - run \`bash scripts/deploy-local.sh\` first (${err.message})`);
  }
}

export function provider(url = DEFAULT_RPC) {
  return new JsonRpcProvider(url);
}

export async function connect({ rpcUrl = DEFAULT_RPC, deploymentPath } = {}) {
  const p = provider(rpcUrl);
  const deployment = await loadDeployment(deploymentPath);
  const [registryAbi, ballotAbi, nftAbi] = await Promise.all([
    abiOf("MemberRegistry"),
    abiOf("PrivateBallot"),
    abiOf("MembershipNFT"),
  ]);
  return {
    provider: p,
    deployment,
    registry: new Contract(deployment.memberRegistry, registryAbi, p),
    ballot: new Contract(deployment.privateBallot, ballotAbi, p),
    nft: new Contract(deployment.membershipNFT, nftAbi, p),
  };
}

export function wallet(privateKey, p) {
  return new Wallet(privateKey, p);
}

/**
 * The registry's leaf list, read back from the chain.
 *
 * We read `MemberRegistered` events rather than the `commitments` array so the
 * result is a log a member can independently re-derive from any archive node, and so
 * the leaf ordering comes from the events themselves.
 */
export async function readMemberLeaves(registry) {
  const events = await registry.queryFilter(registry.filters.MemberRegistered(), 0, "latest");
  const leaves = [];
  for (const ev of events) {
    const index = Number(ev.args.leafIndex);
    leaves[index] = BigInt(ev.args.commitment);
  }
  for (let i = 0; i < leaves.length; i++) {
    if (leaves[i] === undefined) throw new Error(`gap in the member tree at leaf ${i}`);
  }
  return leaves;
}

const ZERO32 = "0x" + "0".repeat(64);

/**
 * Find an unregistered membership NFT owned by `owner`.
 *
 * Registration is keyed on the token, not the wallet, so the member has to name one.
 * This scan works because the demo NFT exposes `totalSupply`; against a production
 * NFT without enumeration, pass the token id explicitly instead.
 */
export async function findUnregisteredToken(nft, registry, owner) {
  let supply;
  try {
    supply = await nft.totalSupply();
  } catch {
    throw new Error("this NFT has no totalSupply() - pass --token-id explicitly");
  }
  for (let tokenId = 1n; tokenId <= supply; tokenId++) {
    if ((await nft.ownerOf(tokenId)) !== owner) continue;
    if ((await registry.commitmentOfToken(tokenId)) === ZERO32) return tokenId;
  }
  return null;
}
