import "dotenv/config";

import { readFile } from "node:fs/promises";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import {
  createPublicClient,
  createWalletClient,
  encodeDeployData,
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
  bytecode?: Hex | { object?: Hex };
};

const rpcUrl = requiredEnv("SEPOLIA_RPC_URL");
const privateKey = requiredPrivateKey("DEPLOYER_PRIVATE_KEY");
const artifactPath = requiredEnv("CONTRACT_ARTIFACT");
const constructorArgs = parseConstructorArgs(process.env.CONSTRUCTOR_ARGS ?? "[]");
const deployValue = parseWeiEnv("DEPLOY_VALUE_WEI");

const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(rpcUrl),
});

const account = privateKeyToAccount(privateKey);
const walletClient = createWalletClient({
  account,
  chain: sepolia,
  transport: http(rpcUrl),
});

const artifact = await readArtifact(artifactPath);
const data = encodeDeployData({
  abi: artifact.abi,
  bytecode: artifact.bytecode,
  args: constructorArgs,
});

const [gas, gasPrice, balance] = await Promise.all([
  publicClient.estimateGas({ account: account.address, data, value: deployValue }),
  publicClient.getGasPrice(),
  publicClient.getBalance({ address: account.address }),
]);

const estimatedGasCost = gas * gasPrice;
const estimatedTotalCost = estimatedGasCost + deployValue;

console.log("Sepolia deployment");
console.log(`  deployer: ${account.address}`);
console.log(`  artifact: ${artifactPath}`);
console.log(`  constructor args: ${JSON.stringify(constructorArgs)}`);
console.log(`  deploy value: ${formatEther(deployValue)} ETH`);
console.log(`  balance: ${formatEther(balance)} ETH`);
console.log(`  estimated gas: ${gas.toString()}`);
console.log(`  gas price: ${formatEther(gasPrice)} ETH`);
console.log(`  estimated gas cost: ${formatEther(estimatedGasCost)} ETH`);
console.log(`  estimated total cost: ${formatEther(estimatedTotalCost)} ETH`);

if (balance < estimatedTotalCost) {
  throw new Error(
    `Deployer balance is too low. Need about ${formatEther(estimatedTotalCost)} ETH, have ${formatEther(balance)} ETH.`,
  );
}

await requireConfirmation("Type DEPLOY to submit this Sepolia deployment: ", "DEPLOY");

const hash = await walletClient.deployContract({
  abi: artifact.abi,
  bytecode: artifact.bytecode,
  args: constructorArgs,
  value: deployValue,
  gas,
  gasPrice,
});

console.log(`Submitted deployment transaction: ${hash}`);

const receipt = await publicClient.waitForTransactionReceipt({ hash });

if (receipt.status !== "success" || !receipt.contractAddress) {
  throw new Error(`Deployment failed in transaction ${hash}.`);
}

console.log(`Contract deployed at: ${getAddress(receipt.contractAddress)}`);

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function requiredPrivateKey(name: string): Hex {
  const value = requiredEnv(name);
  if (!/^0x[0-9a-fA-F]{64}$/.test(value)) {
    throw new Error(`${name} must be a 0x-prefixed 32-byte private key.`);
  }
  return value as Hex;
}

function parseConstructorArgs(raw: string): readonly unknown[] {
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error("CONSTRUCTOR_ARGS must be a JSON array.");
  }
  return parsed;
}

function parseWeiEnv(name: string): bigint {
  const value = process.env[name]?.trim();
  if (!value) {
    return 0n;
  }

  if (!/^[0-9]+$/.test(value)) {
    throw new Error(`${name} must be an integer amount of wei.`);
  }

  return BigInt(value);
}

async function readArtifact(path: string): Promise<{ abi: Abi; bytecode: Hex }> {
  const raw = await readFile(path, "utf8");
  const artifact = JSON.parse(raw) as ContractArtifact;
  const bytecode = typeof artifact.bytecode === "string" ? artifact.bytecode : artifact.bytecode?.object;

  if (!Array.isArray(artifact.abi)) {
    throw new Error(`Artifact ${path} does not contain an ABI array.`);
  }

  if (!bytecode || !/^0x[0-9a-fA-F]+$/.test(bytecode) || bytecode === "0x") {
    throw new Error(`Artifact ${path} does not contain deployable bytecode.`);
  }

  return {
    abi: artifact.abi as Abi,
    bytecode: bytecode as Hex,
  };
}

async function requireConfirmation(prompt: string, expected: string): Promise<void> {
  const rl = createInterface({ input, output });
  try {
    const answer = await rl.question(prompt);
    if (answer.trim() !== expected) {
      throw new Error("Cancelled.");
    }
  } finally {
    rl.close();
  }
}
