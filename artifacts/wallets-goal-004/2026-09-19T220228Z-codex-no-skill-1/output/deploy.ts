import "dotenv/config";

import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  createPublicClient,
  createWalletClient,
  getContractAddress,
  http,
  parseAbi,
  type Abi,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";

type SolidityArtifact = {
  abi?: Abi | string[];
  bytecode?: Hex | { object?: Hex };
  data?: { bytecode?: { object?: Hex } };
};

const rpcUrl = requireEnv("SEPOLIA_RPC_URL");
const privateKey = requirePrivateKey("DEPLOYER_PRIVATE_KEY");
const artifactPath = process.argv[2] ?? process.env.CONTRACT_ARTIFACT_PATH;

if (!artifactPath) {
  throw new Error(
    "Missing contract artifact path. Set CONTRACT_ARTIFACT_PATH or pass it as the first argument.",
  );
}

const constructorArgs = parseConstructorArgs(process.env.CONSTRUCTOR_ARGS ?? "[]");
const artifact = await loadArtifact(artifactPath);
const account = privateKeyToAccount(privateKey);

const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(rpcUrl),
});

const walletClient = createWalletClient({
  account,
  chain: sepolia,
  transport: http(rpcUrl),
});

const nonce = await publicClient.getTransactionCount({ address: account.address });
const predictedAddress = getContractAddress({
  from: account.address,
  nonce: BigInt(nonce),
});

console.log(`Deploying from ${account.address} on Sepolia`);
console.log(`Artifact: ${path.resolve(artifactPath)}`);
console.log(`Predicted contract address: ${predictedAddress}`);

const hash = await walletClient.deployContract({
  abi: artifact.abi,
  bytecode: artifact.bytecode,
  args: constructorArgs,
});

console.log(`Deployment transaction: ${hash}`);

const receipt = await publicClient.waitForTransactionReceipt({ hash });

if (!receipt.contractAddress) {
  throw new Error(`Deployment transaction ${hash} did not create a contract.`);
}

console.log(`Deployed contract address: ${receipt.contractAddress}`);

async function loadArtifact(artifactFile: string): Promise<{ abi: Abi; bytecode: Hex }> {
  const artifactJson = await readFile(path.resolve(artifactFile), "utf8");
  const artifact = JSON.parse(artifactJson) as SolidityArtifact;

  const abi = normalizeAbi(artifact.abi);
  const bytecode =
    normalizeBytecode(artifact.bytecode) ??
    normalizeBytecode(artifact.data?.bytecode?.object);

  if (!bytecode || bytecode === "0x") {
    throw new Error(`No deployable bytecode found in ${artifactFile}.`);
  }

  return { abi, bytecode };
}

function normalizeAbi(abi: SolidityArtifact["abi"]): Abi {
  if (!abi) {
    throw new Error("Artifact is missing an ABI.");
  }

  return Array.isArray(abi) && abi.every((entry) => typeof entry === "string")
    ? parseAbi(abi)
    : (abi as Abi);
}

function normalizeBytecode(bytecode: SolidityArtifact["bytecode"] | Hex | undefined): Hex | undefined {
  const value = typeof bytecode === "string" ? bytecode : bytecode?.object;

  if (!value) {
    return undefined;
  }

  return value.startsWith("0x") ? (value as Hex) : (`0x${value}` as Hex);
}

function parseConstructorArgs(rawArgs: string): readonly unknown[] {
  const parsed = JSON.parse(rawArgs) as unknown;

  if (!Array.isArray(parsed)) {
    throw new Error("CONSTRUCTOR_ARGS must be a JSON array, for example: [\"hello\",42]");
  }

  return parsed;
}

function requireEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing ${name}. Add it to .env or export it in your shell.`);
  }

  return value;
}

function requirePrivateKey(name: string): Hex {
  const value = requireEnv(name);

  if (!/^0x[0-9a-fA-F]{64}$/.test(value)) {
    throw new Error(`${name} must be a 32-byte hex private key with a 0x prefix.`);
  }

  return value as Hex;
}
