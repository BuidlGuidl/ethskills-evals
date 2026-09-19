import { createInterface } from "node:readline/promises";
import {
  createPublicClient,
  createWalletClient,
  formatEther,
  http,
  isAddress,
  isHex,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";

export const chain = sepolia;

export function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is not set. Copy .env.example to .env and fill it in (see README).`);
  }
  return value;
}

/** Parses an address from env, rejecting bad EIP-55 checksums (catches typos). */
export function requireAddress(name: string): Address {
  const value = requireEnv(name);
  if (!isAddress(value, { strict: true })) {
    throw new Error(
      `${name}=${value} is not a valid address or has a bad EIP-55 checksum. ` +
        `Double-check it character by character against the source of truth.`,
    );
  }
  return value;
}

function loadDeployerKey(): Hex {
  const key = requireEnv("DEPLOYER_PRIVATE_KEY");
  const hex = (key.startsWith("0x") ? key : `0x${key}`) as Hex;
  if (!isHex(hex) || hex.length !== 66) {
    throw new Error("DEPLOYER_PRIVATE_KEY must be a 32-byte hex string.");
  }
  return hex;
}

export async function getClients() {
  const transport = http(requireEnv("SEPOLIA_RPC_URL"));
  const account = privateKeyToAccount(loadDeployerKey());
  const publicClient = createPublicClient({ chain, transport });
  const walletClient = createWalletClient({ chain, transport, account });

  // Guard against an RPC URL that points at the wrong network.
  const chainId = await publicClient.getChainId();
  if (chainId !== chain.id) {
    throw new Error(`SEPOLIA_RPC_URL is on chain ${chainId}, expected Sepolia (${chain.id}).`);
  }
  return { account, publicClient, walletClient };
}

export function eth(wei: bigint): string {
  return `${formatEther(wei)} ETH`;
}

export function explorerTx(hash: Hex): string {
  return `${chain.blockExplorers.default.url}/tx/${hash}`;
}

export function explorerAddress(address: Address): string {
  return `${chain.blockExplorers.default.url}/address/${address}`;
}

/** Interactive y/N prompt; skipped when --yes is passed (e.g. in CI). */
export async function confirm(question: string, skip: boolean): Promise<void> {
  if (skip) return;
  if (!process.stdin.isTTY) {
    throw new Error("Not running in a terminal; re-run with --yes to confirm non-interactively.");
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(`${question} [y/N] `);
  rl.close();
  if (answer.trim().toLowerCase() !== "y") {
    console.log("Aborted.");
    process.exit(1);
  }
}

// Print expected failures (bad config, low balance, ...) as one line instead of a stack trace.
for (const event of ["uncaughtException", "unhandledRejection"] as const) {
  process.on(event, (err: unknown) => {
    // viem errors carry a concise shortMessage; the full message includes calldata dumps.
    const message = err instanceof Error ? ((err as { shortMessage?: string }).shortMessage ?? err.message) : String(err);
    console.error(`\nError: ${message}`);
    if (process.env.DEBUG) console.error(err);
    process.exit(1);
  });
}
