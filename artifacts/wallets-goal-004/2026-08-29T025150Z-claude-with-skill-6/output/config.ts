/**
 * Shared setup for the deploy scripts: env loading, clients, and the
 * human-confirmation gate that anything spending funds has to pass.
 */
import "dotenv/config";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
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

/**
 * Where sweep.ts returns leftover ETH. This is a destination, not a signer, so
 * it is safe to keep in the repo. Override with TEAM_ACCOUNT in .env.
 * (The address as originally circulated -- 0xfB047366A183ddEf3f40FF3e4EbF34F8D01Fd3FC
 * -- has the right bytes but a bad EIP-55 checksum; this is the canonical form.)
 */
export const DEFAULT_TEAM_ACCOUNT: Address = getAddress(
  "0xfB047366a183DDEF3F40ff3e4ebf34f8d01FD3Fc",
);

/**
 * Scripts fail with a one-line reason instead of a stack trace. Set DEBUG=1 for
 * the full trace when something unexpected breaks.
 */
function reportAndExit(error: unknown): never {
  if (process.env.DEBUG) console.error(error);
  else console.error(`\nError: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
process.on("uncaughtException", reportAndExit);
process.on("unhandledRejection", reportAndExit);

export const chain = sepolia;

export function rpcUrl(): string {
  const url = process.env.SEPOLIA_RPC_URL;
  if (!url) {
    throw new Error(
      "SEPOLIA_RPC_URL is not set. Copy .env.example to .env and fill it in (see README).",
    );
  }
  return url;
}

export const publicClient = createPublicClient({ chain, transport: http(rpcUrl()) });

/**
 * The deployer key is read from the environment only. It is never committed,
 * never defaulted, and never hardcoded -- see "Key handling" in the README.
 */
export function deployerAccount() {
  const key = process.env.DEPLOYER_PRIVATE_KEY;
  if (!key) {
    throw new Error(
      "DEPLOYER_PRIVATE_KEY is not set. Copy .env.example to .env and fill it in (see README).",
    );
  }
  if (!/^0x[0-9a-fA-F]{64}$/.test(key)) {
    throw new Error(
      "DEPLOYER_PRIVATE_KEY must be a 0x-prefixed 32-byte hex string (66 characters).",
    );
  }
  return privateKeyToAccount(key as Hex);
}

export function walletClient() {
  return createWalletClient({
    account: deployerAccount(),
    chain,
    transport: http(rpcUrl()),
  });
}

export function teamAccount(): Address {
  const raw = process.env.TEAM_ACCOUNT;
  return raw ? getAddress(raw) : DEFAULT_TEAM_ACCOUNT;
}

export function explorerTx(hash: Hex): string {
  return `${chain.blockExplorers.default.url}/tx/${hash}`;
}

export function explorerAddress(address: Address): string {
  return `${chain.blockExplorers.default.url}/address/${address}`;
}

export const eth = (wei: bigint) => `${formatEther(wei)} ETH`;

/**
 * Stops and waits for a human. No --yes bypass on purpose: these scripts move
 * real balances, so a person confirms every run. Aborts if stdin is not a TTY.
 */
export async function confirm(question = "Proceed?"): Promise<void> {
  if (!stdin.isTTY) {
    throw new Error(
      "Refusing to send a transaction without an interactive confirmation. Run this from a terminal.",
    );
  }
  const rl = createInterface({ input: stdin, output: stdout });
  try {
    const answer = await rl.question(`\n${question} Type "yes" to continue: `);
    if (answer.trim().toLowerCase() !== "yes") {
      console.log("Aborted. Nothing was sent.");
      process.exit(1);
    }
  } finally {
    rl.close();
  }
}
