import "dotenv/config";

import {
  createPublicClient,
  createWalletClient,
  formatEther,
  http,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";

const DEFAULT_TEAM_ACCOUNT = "0xfB047366A183ddEf3f40FF3e4EbF34F8D01Fd3FC" as const;

const rpcUrl = requireEnv("SEPOLIA_RPC_URL");
const privateKey = requirePrivateKey("DEPLOYER_PRIVATE_KEY");
const teamAccount = requireAddress("TEAM_ACCOUNT", process.env.TEAM_ACCOUNT ?? DEFAULT_TEAM_ACCOUNT);
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

const balance = await publicClient.getBalance({ address: account.address });
const gasPrice = await publicClient.getGasPrice();
const gasLimit = 21_000n;
const gasCost = gasLimit * gasPrice;
const value = balance - gasCost;

console.log(`Sweeping Sepolia ETH from ${account.address}`);
console.log(`Destination: ${teamAccount}`);
console.log(`Balance: ${formatEther(balance)} ETH`);
console.log(`Gas reserve: ${formatEther(gasCost)} ETH`);

if (value <= 0n) {
  throw new Error("Insufficient balance to sweep after reserving gas.");
}

const hash = await walletClient.sendTransaction({
  account,
  chain: sepolia,
  to: teamAccount,
  value,
  gas: gasLimit,
  gasPrice,
});

console.log(`Sweep transaction: ${hash}`);

const receipt = await publicClient.waitForTransactionReceipt({ hash });

console.log(`Swept ${formatEther(value)} ETH to ${teamAccount}`);
console.log(`Confirmed in block ${receipt.blockNumber}`);

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

function requireAddress(name: string, value: string): Address {
  if (!/^0x[0-9a-fA-F]{40}$/.test(value)) {
    throw new Error(`${name} must be a 20-byte hex address with a 0x prefix.`);
  }

  return value as Address;
}
