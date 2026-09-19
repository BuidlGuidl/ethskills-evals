import { existsSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import {
  createPublicClient,
  createWalletClient,
  formatEther,
  http,
  isHex,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";

if (existsSync(".env")) process.loadEnvFile(".env");

export function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(`Missing ${name}. Copy .env.example to .env and fill it in (see README).`);
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

  // Refuse to run against anything that is not Sepolia, whatever the RPC URL says.
  const chainId = await publicClient.getChainId();
  if (chainId !== sepolia.id) {
    console.error(`RPC reports chain ${chainId}, expected Sepolia (${sepolia.id}). Aborting.`);
    process.exit(1);
  }
  return { account, publicClient, walletClient };
}

export const eth = (wei: bigint) => `${formatEther(wei)} ETH`;

/** Stops until a human types "yes". `--yes` skips the prompt (for when you've already reviewed the numbers). */
export async function confirm(question: string): Promise<void> {
  if (process.argv.includes("--yes")) return;
  if (!stdin.isTTY) {
    console.error("Not an interactive terminal; re-run with --yes once you've reviewed the numbers above.");
    process.exit(1);
  }
  const rl = createInterface({ input: stdin, output: stdout });
  const answer = (await rl.question(`${question} Type "yes" to continue: `)).trim().toLowerCase();
  rl.close();
  if (answer !== "yes") {
    console.log("Aborted. Nothing was sent.");
    process.exit(1);
  }
}
