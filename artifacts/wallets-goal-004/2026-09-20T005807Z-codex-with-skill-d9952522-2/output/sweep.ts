import "dotenv/config";

import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import {
  createPublicClient,
  createWalletClient,
  formatEther,
  getAddress,
  http,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";

const DEFAULT_TEAM_ACCOUNT = "0xfb047366a183ddef3f40ff3e4ebf34f8d01fd3fc";

const rpcUrl = requiredEnv("SEPOLIA_RPC_URL");
const privateKey = requiredPrivateKey("DEPLOYER_PRIVATE_KEY");
const teamAccount = getAddress(process.env.TEAM_ACCOUNT ?? DEFAULT_TEAM_ACCOUNT);

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

const [balance, gasPrice] = await Promise.all([
  publicClient.getBalance({ address: account.address }),
  publicClient.getGasPrice(),
]);

const gas = await estimateSweepGas(teamAccount, balance, gasPrice);
const gasCost = gas * gasPrice;

if (balance <= gasCost) {
  throw new Error(
    `Nothing to sweep after gas. Balance ${formatEther(balance)} ETH, estimated gas cost ${formatEther(gasCost)} ETH.`,
  );
}

const value = balance - gasCost;

console.log("Sepolia balance sweep");
console.log(`  from: ${account.address}`);
console.log(`  to: ${teamAccount}`);
console.log(`  current balance: ${formatEther(balance)} ETH`);
console.log(`  amount to send: ${formatEther(value)} ETH`);
console.log(`  estimated gas: ${gas.toString()}`);
console.log(`  gas price: ${formatEther(gasPrice)} ETH`);
console.log(`  gas reserved: ${formatEther(gasCost)} ETH`);

await requireConfirmation("Type SWEEP to send the deployer balance to the team account: ", "SWEEP");

const hash = await walletClient.sendTransaction({
  to: teamAccount,
  value,
  gas,
  gasPrice,
});

console.log(`Submitted sweep transaction: ${hash}`);

const receipt = await publicClient.waitForTransactionReceipt({ hash });

if (receipt.status !== "success") {
  throw new Error(`Sweep failed in transaction ${hash}.`);
}

console.log(`Sweep confirmed in block ${receipt.blockNumber.toString()}.`);

async function estimateSweepGas(to: Address, balance: bigint, gasPrice: bigint): Promise<bigint> {
  let gas = 21_000n;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const value = balance - gas * gasPrice;
    if (value <= 0n) {
      return gas;
    }

    const nextGas = await publicClient.estimateGas({
      account: account.address,
      to,
      value,
    });

    if (nextGas === gas) {
      return gas;
    }

    gas = nextGas;
  }

  return gas;
}

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
