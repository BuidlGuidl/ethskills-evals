import "dotenv/config";

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  createPublicClient,
  createWalletClient,
  http,
  isHex,
  type Abi,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";

type ContractArtifact = {
  abi?: Abi;
  bytecode?: Hex | { object?: string };
  evm?: {
    bytecode?: {
      object?: string;
    };
  };
};

const SEPOLIA_CHAIN_ID = 11155111;

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing ${name}. Add it to .env or export it before running.`);
  }
  return value;
}

function parsePrivateKey(value: string): Hex {
  if (!/^0x[0-9a-fA-F]{64}$/.test(value)) {
    throw new Error("DEPLOYER_PRIVATE_KEY must be a 32-byte 0x-prefixed private key.");
  }
  return value as Hex;
}

function normalizeBytecode(artifact: ContractArtifact): Hex {
  const bytecode =
    typeof artifact.bytecode === "string"
      ? artifact.bytecode
      : artifact.bytecode?.object ?? artifact.evm?.bytecode?.object;

  if (!bytecode || bytecode === "0x" || !isHex(bytecode)) {
    throw new Error("Artifact does not contain deployable bytecode.");
  }

  return bytecode;
}

function parseConstructorArgs(): unknown[] {
  const raw = process.env.CONTRACT_CONSTRUCTOR_ARGS?.trim() || "[]";
  const parsed = JSON.parse(raw) as unknown;

  if (!Array.isArray(parsed)) {
    throw new Error("CONTRACT_CONSTRUCTOR_ARGS must be a JSON array.");
  }

  return parsed;
}

async function loadArtifact(path: string): Promise<{ abi: Abi; bytecode: Hex }> {
  const artifactPath = resolve(path);
  const artifact = JSON.parse(await readFile(artifactPath, "utf8")) as ContractArtifact;

  if (!Array.isArray(artifact.abi)) {
    throw new Error("Artifact does not contain an ABI array.");
  }

  return {
    abi: artifact.abi,
    bytecode: normalizeBytecode(artifact),
  };
}

async function main() {
  const rpcUrl = requireEnv("SEPOLIA_RPC_URL");
  const privateKey = parsePrivateKey(requireEnv("DEPLOYER_PRIVATE_KEY"));
  const artifactPath = process.env.CONTRACT_ARTIFACT?.trim() || process.argv[2];

  if (!artifactPath) {
    throw new Error(
      "Missing CONTRACT_ARTIFACT. Set it in .env or pass the artifact path as the first argument.",
    );
  }

  const account = privateKeyToAccount(privateKey);
  const transport = http(rpcUrl);
  const publicClient = createPublicClient({ chain: sepolia, transport });
  const walletClient = createWalletClient({ account, chain: sepolia, transport });
  const chainId = await publicClient.getChainId();

  if (chainId !== SEPOLIA_CHAIN_ID) {
    throw new Error(`RPC is connected to chain ${chainId}, expected Sepolia (${SEPOLIA_CHAIN_ID}).`);
  }

  const { abi, bytecode } = await loadArtifact(artifactPath);
  const args = parseConstructorArgs();

  console.log(`Deploying from ${account.address}`);
  console.log(`Artifact: ${resolve(artifactPath)}`);
  console.log(`Constructor args: ${JSON.stringify(args)}`);

  const hash = await walletClient.deployContract({
    abi,
    bytecode,
    args,
    account,
    chain: sepolia,
  });

  console.log(`Deployment transaction: ${hash}`);

  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  if (!receipt.contractAddress) {
    throw new Error(`Deployment transaction ${hash} did not create a contract.`);
  }

  console.log(`Contract deployed at: ${receipt.contractAddress}`);
  console.log(`Sepolia Etherscan: https://sepolia.etherscan.io/address/${receipt.contractAddress}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
