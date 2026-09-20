import "dotenv/config";
import { readFile } from "node:fs/promises";
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
    throw new Error(`Missing ${name}. See README.md for setup.`);
  }
  return value;
}

function readPrivateKey(): Hex {
  const privateKey = requiredEnv("DEPLOYER_PRIVATE_KEY");
  if (!/^0x[0-9a-fA-F]{64}$/.test(privateKey)) {
    throw new Error("DEPLOYER_PRIVATE_KEY must be a 32-byte hex private key prefixed with 0x.");
  }
  return privateKey as Hex;
}

function parseConstructorArgs(): readonly unknown[] {
  const raw = process.env.CONSTRUCTOR_ARGS_JSON ?? "[]";
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error("CONSTRUCTOR_ARGS_JSON must be a JSON array.");
  }
  return parsed;
}

function readBytecode(artifact: ContractArtifact): Hex {
  const bytecode =
    typeof artifact.bytecode === "string"
      ? artifact.bytecode
      : typeof artifact.bytecode === "object" &&
          artifact.bytecode !== null &&
          "object" in artifact.bytecode &&
          typeof artifact.bytecode.object === "string"
        ? artifact.bytecode.object
        : typeof artifact.evm?.bytecode?.object === "string"
          ? artifact.evm.bytecode.object
          : undefined;

  if (!bytecode || bytecode === "0x") {
    throw new Error("Contract artifact does not contain deployable bytecode.");
  }

  return bytecode.startsWith("0x") ? (bytecode as Hex) : (`0x${bytecode}` as Hex);
}

async function loadArtifact(path: string): Promise<{ abi: Abi; bytecode: Hex }> {
  const artifactPath = resolve(path);
  const artifact = JSON.parse(await readFile(artifactPath, "utf8")) as ContractArtifact;

  if (!Array.isArray(artifact.abi)) {
    throw new Error("Contract artifact does not contain an ABI array.");
  }

  return {
    abi: artifact.abi as Abi,
    bytecode: readBytecode(artifact),
  };
}

async function main() {
  const rpcUrl = requiredEnv("SEPOLIA_RPC_URL");
  const artifactPath = requiredEnv("CONTRACT_ARTIFACT");
  const constructorArgs = parseConstructorArgs();
  const account = privateKeyToAccount(readPrivateKey());
  const { abi, bytecode } = await loadArtifact(artifactPath);

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
  console.log(`Deploying from ${getAddress(account.address)} on Sepolia`);
  console.log(`Deployer balance: ${formatEther(balance)} ETH`);

  const hash = await walletClient.deployContract({
    account,
    abi,
    bytecode,
    args: constructorArgs,
  });

  console.log(`Deployment transaction: ${hash}`);

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (!receipt.contractAddress) {
    throw new Error(`Deployment transaction ${hash} completed without a contract address.`);
  }

  console.log(`Contract deployed at: ${getAddress(receipt.contractAddress)}`);
  console.log(`Block: ${receipt.blockNumber}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
