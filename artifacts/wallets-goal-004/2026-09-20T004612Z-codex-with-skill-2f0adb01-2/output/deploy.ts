import "dotenv/config";

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  createPublicClient,
  createWalletClient,
  formatEther,
  getAddress,
  http,
  type Abi,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";

type ContractArtifact = {
  abi?: unknown;
  bytecode?: unknown;
  evm?: {
    bytecode?: {
      object?: unknown;
    };
  };
};

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name}. Copy .env.example to .env and fill it in.`);
  }
  return value;
}

function normalizePrivateKey(value: string): Hex {
  const privateKey = value.startsWith("0x") ? value : `0x${value}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(privateKey)) {
    throw new Error("DEPLOYER_PRIVATE_KEY must be a 32-byte hex private key.");
  }
  return privateKey as Hex;
}

function normalizeBytecode(value: unknown): Hex {
  if (typeof value !== "string") {
    throw new Error("Contract artifact is missing bytecode.");
  }

  const bytecode = value.startsWith("0x") ? value : `0x${value}`;
  if (!/^0x[0-9a-fA-F]+$/.test(bytecode) || bytecode === "0x") {
    throw new Error("Contract artifact bytecode is empty or invalid.");
  }

  return bytecode as Hex;
}

function readArtifact(): { abi: Abi; bytecode: Hex; artifactPath: string } {
  const artifactPath = resolve(process.argv[2] ?? requiredEnv("CONTRACT_ARTIFACT"));
  if (!existsSync(artifactPath)) {
    throw new Error(`Contract artifact not found: ${artifactPath}`);
  }

  const artifact = JSON.parse(readFileSync(artifactPath, "utf8")) as ContractArtifact;
  if (!Array.isArray(artifact.abi)) {
    throw new Error("Contract artifact is missing an ABI array.");
  }

  const bytecodeSource =
    typeof artifact.bytecode === "string"
      ? artifact.bytecode
      : artifact.evm?.bytecode?.object;

  return {
    abi: artifact.abi as Abi,
    bytecode: normalizeBytecode(bytecodeSource),
    artifactPath,
  };
}

function readConstructorArgs(): readonly unknown[] {
  const rawArgs = process.argv[3] ?? process.env.CONSTRUCTOR_ARGS ?? "[]";
  const args = JSON.parse(rawArgs) as unknown;

  if (!Array.isArray(args)) {
    throw new Error("CONSTRUCTOR_ARGS must be a JSON array.");
  }

  return args;
}

async function main() {
  const rpcUrl = requiredEnv("SEPOLIA_RPC_URL");
  const account = privateKeyToAccount(normalizePrivateKey(requiredEnv("DEPLOYER_PRIVATE_KEY")));
  const { abi, bytecode, artifactPath } = readArtifact();
  const args = readConstructorArgs();

  const transport = http(rpcUrl);
  const publicClient = createPublicClient({
    chain: sepolia,
    transport,
  });
  const walletClient = createWalletClient({
    account,
    chain: sepolia,
    transport,
  });

  const deployerAddress = getAddress(account.address);
  const balance = await publicClient.getBalance({ address: deployerAddress });

  console.log(`Deploying artifact: ${artifactPath}`);
  console.log(`Deployer: ${deployerAddress}`);
  console.log(`Sepolia balance: ${formatEther(balance)} ETH`);
  console.log(`Constructor args: ${JSON.stringify(args)}`);

  const hash = await walletClient.deployContract({
    abi,
    account,
    args,
    bytecode,
    chain: sepolia,
  });

  console.log(`Deploy transaction: ${hash}`);

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success" || !receipt.contractAddress) {
    throw new Error(`Deploy failed in transaction ${hash}.`);
  }

  console.log(`Contract deployed: ${getAddress(receipt.contractAddress)}`);
  console.log(`Block: ${receipt.blockNumber}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
