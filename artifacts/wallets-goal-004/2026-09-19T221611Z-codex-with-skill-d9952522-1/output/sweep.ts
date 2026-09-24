import "dotenv/config";

import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import {
  type Address,
  type Hex,
  createPublicClient,
  createWalletClient,
  formatEther,
  formatGwei,
  getAddress,
  http,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";

const DEFAULT_TEAM_ACCOUNT = "0xfB047366A183ddEf3f40FF3e4EbF34F8D01Fd3FC";

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

function loadRecipient(): Address {
  return getAddress(process.env.TEAM_ACCOUNT?.trim() || DEFAULT_TEAM_ACCOUNT);
}

function loadReserveWei(): bigint {
  const raw = process.env.SWEEP_RESERVE_WEI?.trim() || "0";
  if (!/^\d+$/.test(raw)) {
    throw new Error("SWEEP_RESERVE_WEI must be an integer wei amount.");
  }
  return BigInt(raw);
}

async function confirmSweep() {
  const rl = createInterface({ input, output });
  try {
    const answer = await rl.question("Type SWEEP to broadcast this transaction: ");
    if (answer !== "SWEEP") {
      throw new Error("Sweep cancelled.");
    }
  } finally {
    rl.close();
  }
}

async function main() {
  const rpcUrl = required("SEPOLIA_RPC_URL");
  const account = privateKeyToAccount(ensureHex(required("DEPLOYER_PRIVATE_KEY"), "DEPLOYER_PRIVATE_KEY"));
  const recipient = loadRecipient();
  const reserveWei = loadReserveWei();

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
  const gasPrice = await publicClient.getGasPrice();

  const estimateGas = async (value: bigint) =>
    publicClient.estimateGas({
      account: account.address,
      to: recipient,
      value,
    });

  let gas = await estimateGas(1n).catch(() => 21_000n);
  let gasCost = gas * gasPrice;
  let value = balance - gasCost - reserveWei;

  if (value <= 0n) {
    throw new Error(
      `Nothing to sweep. Balance ${formatEther(balance)} ETH does not cover gas plus reserve.`,
    );
  }

  gas = await estimateGas(value);
  gasCost = gas * gasPrice;
  value = balance - gasCost - reserveWei;

  if (value <= 0n) {
    throw new Error(
      `Nothing to sweep after final gas estimate. Balance ${formatEther(balance)} ETH does not cover gas plus reserve.`,
    );
  }

  console.log(`Network: ${sepolia.name} (${sepolia.id})`);
  console.log(`From: ${getAddress(account.address)}`);
  console.log(`To: ${recipient}`);
  console.log(`Current balance: ${formatEther(balance)} ETH`);
  console.log(`Gas limit: ${gas.toString()}`);
  console.log(`Gas price: ${formatGwei(gasPrice)} gwei`);
  console.log(`Gas cost: ${formatEther(gasCost)} ETH`);
  console.log(`Reserve: ${reserveWei.toString()} wei`);
  console.log(`Amount to send: ${formatEther(value)} ETH`);

  await confirmSweep();

  const hash = await walletClient.sendTransaction({
    to: recipient,
    value,
    gas,
    gasPrice,
  });

  console.log(`Sweep transaction: ${hash}`);

  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  if (receipt.status !== "success") {
    throw new Error(`Sweep failed in transaction ${hash}`);
  }

  console.log("Sweep confirmed.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
