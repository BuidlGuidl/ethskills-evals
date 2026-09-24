import "dotenv/config";

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  type Abi,
  type Hex,
  createPublicClient,
  createWalletClient,
  formatEther,
  getAddress,
  http,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";

type Artifact = {
  abi?: Abi;
  bytecode?: Hex | { object?: Hex };
};

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing ${name}. Add it to .env or export it in your shell.`);
  }
  return value;
}

function ensureHex(value: string, label: string): Hex {
  const hex = value.startsWith("0x") ? value : `0x${value}`;
  if (!/^0x[0-9a-fA-F]+$/.test(hex)) {
    throw new Error(`${label} must be a hex string.`);
  }
  return hex as Hex;
}

function loadDeploymentInput(): { abi: Abi; bytecode: Hex } {
  const artifactPath = process.env.CONTRACT_ARTIFACT?.trim();

  if (artifactPath) {
    const absolutePath = resolve(artifactPath);
    if (!existsSync(absolutePath)) {
      throw new Error(`CONTRACT_ARTIFACT does not exist: ${absolutePath}`);
    }

    const artifact = JSON.parse(readFileSync(absolutePath, "utf8")) as Artifact;
    const bytecode =
      typeof artifact.bytecode === "string"
        ? artifact.bytecode
        : artifact.bytecode?.object;

    if (!bytecode || bytecode === "0x") {
      throw new Error(`Artifact has no deployable bytecode: ${absolutePath}`);
    }

    return {
      abi: artifact.abi ?? [],
      bytecode: ensureHex(bytecode, "artifact.bytecode"),
    };
  }

  const bytecode = process.env.CONTRACT_BYTECODE?.trim();
  if (!bytecode) {
    throw new Error("Set CONTRACT_ARTIFACT or CONTRACT_BYTECODE.");
  }

  const abi = process.env.CONTRACT_ABI
    ? (JSON.parse(process.env.CONTRACT_ABI) as Abi)
    : [];

  return {
    abi,
    bytecode: ensureHex(bytecode, "CONTRACT_BYTECODE"),
  };
}

function loadConstructorArgs(): readonly unknown[] {
  const raw = process.env.CONSTRUCTOR_ARGS?.trim() || "[]";
  const parsed = JSON.parse(raw) as unknown;

  if (!Array.isArray(parsed)) {
    throw new Error("CONSTRUCTOR_ARGS must be a JSON array.");
  }

  return parsed;
}

async function main() {
  const rpcUrl = required("SEPOLIA_RPC_URL");
  const account = privateKeyToAccount(ensureHex(required("DEPLOYER_PRIVATE_KEY"), "DEPLOYER_PRIVATE_KEY"));
  const { abi, bytecode } = loadDeploymentInput();
  const args = loadConstructorArgs();

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

  console.log(`Network: ${sepolia.name} (${sepolia.id})`);
  console.log(`Deployer: ${getAddress(account.address)}`);
  console.log(`Deployer balance: ${formatEther(balance)} ETH`);
  console.log(`Constructor args: ${JSON.stringify(args)}`);

  const hash = await walletClient.deployContract({
    abi,
    bytecode,
    args,
  });

  console.log(`Deployment transaction: ${hash}`);

  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  if (receipt.status !== "success" || !receipt.contractAddress) {
    throw new Error(`Deployment failed in transaction ${hash}`);
  }

  console.log(`Deployed address: ${getAddress(receipt.contractAddress)}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
