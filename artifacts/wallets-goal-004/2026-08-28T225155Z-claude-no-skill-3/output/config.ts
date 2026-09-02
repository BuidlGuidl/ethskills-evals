/**
 * Shared setup for the deploy scripts: loads .env, validates it, and builds the
 * viem clients. Everything secret comes from the environment — nothing in this
 * repo should ever contain a real private key.
 */
import "dotenv/config";
import {
  createPublicClient,
  createWalletClient,
  formatEther,
  getAddress,
  http,
  isAddress,
  parseEther,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";

const DEFAULT_RPC_URL = "https://ethereum-sepolia-rpc.publicnode.com";

/** Fail with a readable message instead of a stack trace. */
export function fail(message: string): never {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
}

function requirePrivateKey(): Hex {
  const raw = process.env.DEPLOYER_PRIVATE_KEY?.trim();
  if (!raw) {
    fail(
      "DEPLOYER_PRIVATE_KEY is not set.\n" +
        "  Copy .env.example to .env and fill it in (`cp .env.example .env`).\n" +
        "  Need a key? Run `npm run new-key`.",
    );
  }
  const key = (raw.startsWith("0x") ? raw : `0x${raw}`) as Hex;
  if (!/^0x[0-9a-fA-F]{64}$/.test(key)) {
    fail(
      "DEPLOYER_PRIVATE_KEY is not a valid private key " +
        "(expected 0x followed by 64 hex characters).\n" +
        "  Note: a private key is 32 bytes; a wallet *address* is 20 bytes and " +
        "cannot be used to sign.",
    );
  }
  return key;
}

function requireTeamAccount(): Address {
  const raw = process.env.TEAM_ACCOUNT?.trim();
  if (!raw) fail("TEAM_ACCOUNT is not set. See .env.example.");
  if (!isAddress(raw, { strict: false })) {
    fail(`TEAM_ACCOUNT is not a valid address: ${raw}`);
  }

  // EIP-55: a mixed-case address encodes a checksum over its own digits. If it
  // doesn't validate, the address has been mistyped or mangled somewhere —
  // refuse rather than send funds somewhere irreversible. An all-lowercase or
  // all-uppercase address carries no checksum, so there is nothing to verify.
  const body = raw.slice(2);
  const hasChecksum = body !== body.toLowerCase() && body !== body.toUpperCase();
  const checksummed = getAddress(raw.toLowerCase());
  if (hasChecksum && raw !== checksummed) {
    fail(
      `TEAM_ACCOUNT fails its EIP-55 checksum:\n` +
        `    given    ${raw}\n` +
        `    expected ${checksummed}\n` +
        "  The capitalisation doesn't match the address digits, which usually " +
        "means\n  the address was mistyped or copied badly. Confirm it against " +
        "the wallet\n  itself before sweeping — transfers cannot be undone.",
    );
  }
  return checksummed;
}

export const rpcUrl = process.env.SEPOLIA_RPC_URL?.trim() || DEFAULT_RPC_URL;

export const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(rpcUrl),
});

/** Lazily built so read-only commands don't require a private key. */
export function getAccount() {
  return privateKeyToAccount(requirePrivateKey());
}

export function getWalletClient() {
  return createWalletClient({
    account: getAccount(),
    chain: sepolia,
    transport: http(rpcUrl),
  });
}

export { requireTeamAccount as teamAccount };

/**
 * Guard against a mainnet (or any non-Sepolia) RPC URL in .env. Every script
 * calls this before it signs anything — these scripts are for testnet only.
 */
export async function assertSepolia(): Promise<void> {
  let chainId: number;
  try {
    chainId = await publicClient.getChainId();
  } catch (error) {
    fail(
      `Could not reach the RPC endpoint at ${rpcUrl}\n` +
        `  ${(error as Error).message}`,
    );
  }
  if (chainId !== sepolia.id) {
    fail(
      `SEPOLIA_RPC_URL points at chain ${chainId}, not Sepolia (${sepolia.id}).\n` +
        "  Refusing to continue — these scripts are testnet-only.",
    );
  }
}

/**
 * Estimates gas for a call. Nodes reject an estimate the sender can't pay for,
 * which hides the real gas number behind a balance error — so ask first with
 * the sender's balance overridden, and fall back for nodes without that
 * support. Lets callers report "you need X, you have Y" instead of passing an
 * opaque RPC error to the user.
 */
export async function estimateGasFunded(params: {
  address: Address;
  to?: Address;
  data?: Hex;
  value?: bigint;
}): Promise<bigint> {
  const { address, ...call } = params;
  try {
    return await publicClient.estimateGas({
      account: address,
      ...call,
      stateOverride: [{ address, balance: parseEther("1000") }],
    });
  } catch {
    return await publicClient.estimateGas({ account: address, ...call });
  }
}

export function explorerTx(hash: Hex): string {
  return `${sepolia.blockExplorers.default.url}/tx/${hash}`;
}

export function explorerAddress(address: Address): string {
  return `${sepolia.blockExplorers.default.url}/address/${address}`;
}

export function eth(wei: bigint): string {
  return `${formatEther(wei)} ETH`;
}

/** Ask for confirmation on the terminal. `--yes` on the CLI skips the prompt. */
export async function confirm(question: string): Promise<boolean> {
  if (process.argv.includes("--yes") || process.argv.includes("-y")) return true;
  if (!process.stdin.isTTY) {
    fail("Not running interactively — re-run with --yes to confirm.");
  }
  const { createInterface } = await import("node:readline/promises");
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await rl.question(`${question} [y/N] `);
    return answer.trim().toLowerCase() === "y";
  } finally {
    rl.close();
  }
}
