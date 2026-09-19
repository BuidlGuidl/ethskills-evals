import { existsSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import {
  createPublicClient,
  createWalletClient,
  formatEther,
  getAddress,
  http,
  isAddress,
  type Address,
  type Chain,
  type Hex,
} from "viem";
import { privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";
import { foundry, sepolia } from "viem/chains";

// Accounts whose private keys have leaked (for example, pasted into chat or a
// ticket). deploy.ts will not sign with them. sweep.ts still can, so any funds
// left in them can be moved out.
export const BURNED_ACCOUNTS: readonly Address[] = [
  "0x6Ed090E7EBd28B191810eaBc9b2c31B9660A2402",
];

if (existsSync(".env")) process.loadEnvFile(".env");

export function fail(message: string): never {
  console.error(`\nError: ${message}`);
  process.exit(1);
}

export function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) fail(`${name} is not set. Copy .env.example to .env and fill it in.`);
  return value;
}

export function loadNetwork(): { chain: Chain; rpcUrl: string } {
  const network = (process.env.NETWORK?.trim() || "sepolia").toLowerCase();
  if (network === "sepolia") return { chain: sepolia, rpcUrl: requireEnv("SEPOLIA_RPC_URL") };
  if (network === "anvil") {
    return { chain: foundry, rpcUrl: process.env.ANVIL_RPC_URL?.trim() || "http://127.0.0.1:8545" };
  }
  fail(`NETWORK must be "sepolia" or "anvil", got "${network}".`);
}

export function loadDeployer(): PrivateKeyAccount {
  const key = requireEnv("DEPLOYER_PRIVATE_KEY");
  if (!/^0x[0-9a-fA-F]{64}$/.test(key)) {
    fail("DEPLOYER_PRIVATE_KEY must be 0x followed by 64 hex characters.");
  }
  return privateKeyToAccount(key as Hex);
}

/** Only accepts an address with a valid EIP-55 checksum, or one that is all lowercase. */
export function parseAddress(name: string, value: string): Address {
  if (!isAddress(value, { strict: true })) {
    fail(
      `${name}=${value} is not a valid address. If it has mixed case, the checksum is wrong, ` +
        `which usually means a typo. Get the address again from the source of truth; don't just re-checksum it.`,
    );
  }
  return getAddress(value);
}

export async function connect(account: PrivateKeyAccount) {
  const { chain, rpcUrl } = loadNetwork();
  const transport = http(rpcUrl);
  const publicClient = createPublicClient({ chain, transport });
  const walletClient = createWalletClient({ account, chain, transport });

  // Make sure the RPC is on the chain we think it is before signing anything.
  const rpcChainId = await publicClient.getChainId();
  if (rpcChainId !== chain.id) {
    fail(`RPC reports chain id ${rpcChainId}, expected ${chain.id} (${chain.name}). Check your RPC URL.`);
  }
  return { chain, publicClient, walletClient };
}

export function explorerLink(chain: Chain, kind: "tx" | "address", value: string): string {
  const base = chain.blockExplorers?.default.url;
  return base ? `${base}/${kind}/${value}` : value;
}

export const eth = (wei: bigint) => `${formatEther(wei)} ETH`;

/** Wait for a person to type "yes". Anything else aborts. */
export async function confirmOrExit(question: string): Promise<void> {
  if (!process.stdin.isTTY) {
    fail("You have to confirm this in an interactive terminal. Refusing to sign without one.");
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = (await rl.question(`\n${question} Type "yes" to continue: `)).trim().toLowerCase();
  rl.close();
  if (answer !== "yes") {
    console.log("Aborted. Nothing was sent.");
    process.exit(1);
  }
}
