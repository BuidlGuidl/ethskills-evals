import "dotenv/config";

import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import {
  createPublicClient,
  createWalletClient,
  formatEther,
  getAddress,
  http,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";

const TEAM_ACCOUNT = getAddress("0xfB047366A183ddEf3f40FF3e4EbF34F8D01Fd3FC");

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

async function confirmSweep(value: bigint, from: string) {
  if (process.argv.includes("--yes")) {
    return;
  }

  const rl = createInterface({ input, output });
  try {
    console.log("");
    console.log(`About to sweep ${formatEther(value)} Sepolia ETH`);
    console.log(`From: ${from}`);
    console.log(`To:   ${TEAM_ACCOUNT}`);
    const answer = await rl.question('Type "sweep" to send this transaction: ');
    if (answer !== "sweep") {
      throw new Error("Sweep cancelled.");
    }
  } finally {
    rl.close();
  }
}

async function main() {
  const rpcUrl = requiredEnv("SEPOLIA_RPC_URL");
  const account = privateKeyToAccount(normalizePrivateKey(requiredEnv("DEPLOYER_PRIVATE_KEY")));

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

  const from = getAddress(account.address);
  const balance = await publicClient.getBalance({ address: from });
  if (balance === 0n) {
    console.log(`Deployer ${from} has no Sepolia ETH to sweep.`);
    return;
  }

  const [estimatedGas, fees] = await Promise.all([
    publicClient.estimateGas({
      account,
      to: TEAM_ACCOUNT,
      value: 0n,
    }),
    publicClient.estimateFeesPerGas(),
  ]);

  const gas = (estimatedGas * 120n) / 100n;
  const maxFeePerGas = fees.maxFeePerGas;
  const maxPriorityFeePerGas = fees.maxPriorityFeePerGas;
  const feeReserve = gas * maxFeePerGas;

  if (balance <= feeReserve) {
    throw new Error(
      `Balance ${formatEther(balance)} ETH is not enough to cover the estimated fee reserve ${formatEther(
        feeReserve,
      )} ETH.`,
    );
  }

  const value = balance - feeReserve;

  console.log(`Deployer: ${from}`);
  console.log(`Team account: ${TEAM_ACCOUNT}`);
  console.log(`Current balance: ${formatEther(balance)} Sepolia ETH`);
  console.log(`Estimated gas limit: ${gas}`);
  console.log(`Max fee reserve: ${formatEther(feeReserve)} Sepolia ETH`);
  console.log(`Sweep amount: ${formatEther(value)} Sepolia ETH`);

  if (process.argv.includes("--dry-run")) {
    console.log("Dry run only. Re-run without --dry-run to send.");
    return;
  }

  await confirmSweep(value, from);

  const hash = await walletClient.sendTransaction({
    account,
    to: TEAM_ACCOUNT,
    value,
    gas,
    maxFeePerGas,
    maxPriorityFeePerGas,
    chain: sepolia,
  });

  console.log(`Sweep transaction: ${hash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    throw new Error(`Sweep failed in transaction ${hash}.`);
  }

  const remaining = await publicClient.getBalance({ address: from });
  console.log(`Sweep confirmed in block ${receipt.blockNumber}.`);
  console.log(`Remaining deployer balance: ${formatEther(remaining)} Sepolia ETH`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
