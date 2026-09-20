import "dotenv/config";

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  createPublicClient,
  createWalletClient,
  formatEther,
  http,
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

const DEFAULT_ARTIFACT_PATH = "out/Contract.sol/Contract.json";

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing ${name}. Add it to .env or export it in your shell.`);
  }
  return value;
}

function readPrivateKey(): Hex {
  const privateKey = requiredEnv("DEPLOYER_PRIVATE_KEY");
  if (!/^0x[0-9a-fA-F]{64}$/.test(privateKey)) {
    throw new Error("DEPLOYER_PRIVATE_KEY must be a 32-byte hex private key with a 0x prefix.");
  }
  return privateKey as Hex;
}

function parseConstructorArgs(): readonly unknown[] {
  const rawArgs = process.env.CONSTRUCTOR_ARGS?.trim() || "[]";
  const parsed = JSON.parse(rawArgs) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error("CONSTRUCTOR_ARGS must be a JSON array, for example: [\"name\",42].");
  }
  return parsed;
}

function normalizeBytecode(bytecode: string | undefined): Hex {
  if (!bytecode) {
    throw new Error("Contract artifact does not contain deployable bytecode.");
  }

  const normalized = bytecode.startsWith("0x") ? bytecode : `0x${bytecode}`;
  if (!/^0x[0-9a-fA-F]+$/.test(normalized) || normalized === "0x") {
    throw new Error("Contract artifact bytecode is empty or invalid.");
  }

  return normalized as Hex;
}

function artifactBytecode(artifact: ContractArtifact): Hex {
  if (typeof artifact.bytecode === "string") {
    return normalizeBytecode(artifact.bytecode);
  }

  return normalizeBytecode(artifact.bytecode?.object ?? artifact.evm?.bytecode?.object);
}

async function loadArtifact(path: string): Promise<{ abi: Abi; bytecode: Hex }> {
  const artifactPath = resolve(path);
  const raw = await readFile(artifactPath, "utf8");
  const artifact = JSON.parse(raw) as ContractArtifact;

  if (!Array.isArray(artifact.abi)) {
    throw new Error(`Contract artifact at ${artifactPath} does not contain an ABI array.`);
  }

  return {
    abi: artifact.abi,
    bytecode: artifactBytecode(artifact),
  };
}

async function main() {
  const rpcUrl = requiredEnv("SEPOLIA_RPC_URL");
  const artifactPath = process.env.CONTRACT_ARTIFACT?.trim() || DEFAULT_ARTIFACT_PATH;
  const constructorArgs = parseConstructorArgs();
  const account = privateKeyToAccount(readPrivateKey());
  const artifact = await loadArtifact(artifactPath);

  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http(rpcUrl),
  });

  const walletClient = createWalletClient({
    account,
    chain: sepolia,
    transport: http(rpcUrl),
  });

  const balance = await publicClient.getBalance({ address: account.address });
  console.log(`Deploying from: ${account.address}`);
  console.log(`Artifact: ${resolve(artifactPath)}`);
  console.log(`Constructor args: ${JSON.stringify(constructorArgs)}`);
  console.log(`Sepolia balance: ${formatEther(balance)} ETH`);

  const hash = await walletClient.deployContract({
    abi: artifact.abi,
    bytecode: artifact.bytecode,
    args: constructorArgs,
  });

  console.log(`Deployment transaction: ${hash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  if (receipt.status !== "success" || !receipt.contractAddress) {
    throw new Error(`Deployment failed in transaction ${hash}.`);
  }

  console.log(`Deployed address: ${receipt.contractAddress}`);
  console.log(`Block: ${receipt.blockNumber}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
