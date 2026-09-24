import { existsSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import {
  createPublicClient,
  createWalletClient,
  http,
  isHex,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";

// Load .env if present (Node >= 20.12). Real env vars take precedence.
if (existsSync(".env")) process.loadEnvFile(".env");

export function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(`Missing ${name}. Copy .env.example to .env and fill it in.`);
    process.exit(1);
  }
  return value;
}

export function loadDeployer() {
  const key = requireEnv("DEPLOYER_PRIVATE_KEY");
  if (!isHex(key) || key.length !== 66) {
    console.error("DEPLOYER_PRIVATE_KEY must be 0x followed by 64 hex characters.");
    process.exit(1);
  }
  return privateKeyToAccount(key as Hex);
}

export async function makeClients() {
  const transport = http(requireEnv("SEPOLIA_RPC_URL"));
  const account = loadDeployer();
  const publicClient = createPublicClient({ chain: sepolia, transport });
  const walletClient = createWalletClient({ account, chain: sepolia, transport });

  // Refuse to run against anything that isn't Sepolia, whatever the URL says.
  const chainId = await publicClient.getChainId();
  if (chainId !== sepolia.id) {
    console.error(`RPC reports chain ${chainId}, expected Sepolia (${sepolia.id}). Aborting.`);
    process.exit(1);
  }
  return { account, publicClient, walletClient };
}

export async function confirm(question: string): Promise<boolean> {
  if (process.argv.includes("--yes") || process.argv.includes("-y")) return true;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(`${question} [y/N] `);
  rl.close();
  return answer.trim().toLowerCase() === "y";
}

export const explorer = (path: string) => `${sepolia.blockExplorers.default.url}/${path}`;
