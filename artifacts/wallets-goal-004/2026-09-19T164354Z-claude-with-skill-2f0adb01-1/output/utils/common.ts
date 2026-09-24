import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { decryptKeystoreJson } from "ethers";
import {
  createPublicClient,
  createWalletClient,
  http,
  isAddress,
  getAddress,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";

// Non-secret config (RPC URL, keystore name, team address) lives in .env.
if (existsSync(".env")) process.loadEnvFile(".env");

// Deployer keys that have been exposed (pasted in chat, committed to git, etc.).
// Anything sent to these is at risk, so the scripts refuse to use them.
const COMPROMISED_ADDRESSES = new Set<string>([
  "0x6Ed090E7EBd28B191810eaBc9b2c31B9660A2402",
]);

export function fail(msg: string): never {
  console.error(`\n✖ ${msg}`);
  process.exit(1);
}

export function requireEnv(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) fail(`${name} is not set. Copy .env.example to .env and fill it in.`);
  return v;
}

/** Strict address parsing: rejects mixed-case addresses whose EIP-55 checksum is wrong. */
export function parseAddress(name: string, value: string): Address {
  if (!isAddress(value, { strict: true })) {
    fail(
      `${name}=${value} is not a valid address. If it is mixed-case, its EIP-55 checksum ` +
        `does not match — likely a typo. Re-copy it from a trusted source.`,
    );
  }
  return getAddress(value);
}

export function clients(account?: ReturnType<typeof privateKeyToAccount>) {
  const transport = http(requireEnv("SEPOLIA_RPC_URL"));
  const publicClient = createPublicClient({ chain: sepolia, transport });
  const walletClient = account
    ? createWalletClient({ account, chain: sepolia, transport })
    : undefined;
  return { publicClient, walletClient };
}

/** Refuse to run against anything but Sepolia, whatever the RPC URL says. */
export async function assertSepolia(publicClient: ReturnType<typeof clients>["publicClient"]) {
  const chainId = await publicClient.getChainId();
  if (chainId !== sepolia.id) {
    fail(`RPC is on chain ${chainId}, expected Sepolia (${sepolia.id}). Check SEPOLIA_RPC_URL.`);
  }
}

// One readline for the whole run, so input typed/pasted ahead isn't lost between prompts.
let rl: ReturnType<typeof createInterface> | undefined;
let muted = false;
let currentQuestion = "";
let waiting = false;
let closed = false;

function prompt(question: string, hidden = false): Promise<string> {
  if (!rl) {
    rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    // Suppress echo of typed characters while `muted` (password entry).
    const writer = rl as unknown as { _writeToOutput: (s: string) => void };
    const original = writer._writeToOutput.bind(rl);
    writer._writeToOutput = (s: string) => {
      if (!muted || s.includes(currentQuestion)) original(s);
    };
    // Ctrl-D / closed stdin while a question is open: abort rather than hang or crash.
    rl.once("close", () => {
      closed = true;
      if (waiting) fail("Input closed — aborted, nothing was sent.");
    });
  }
  if (closed) fail("Input closed — aborted, nothing was sent.");
  muted = hidden;
  currentQuestion = question;
  waiting = true;
  return new Promise((resolve) => {
    rl!.question(question, (answer) => {
      if (hidden) process.stdout.write("\n");
      muted = false;
      waiting = false;
      resolve(answer);
    });
  });
}

/** Shows what is about to happen and requires an explicit "yes". Always the last prompt. */
export async function confirm(summary: string): Promise<void> {
  console.log(`\n${summary}\n`);
  const answer = await prompt('Type "yes" to send this transaction: ');
  rl?.close();
  if (answer.trim().toLowerCase() !== "yes") fail("Aborted — nothing was sent.");
}

/**
 * Loads the deployer from an encrypted Foundry keystore (Web3 Secret Storage JSON).
 * The key is decrypted in memory only; it is never read from .env or printed.
 */
export async function loadDeployer() {
  const path =
    process.env.DEPLOYER_KEYSTORE_PATH?.trim() ||
    join(homedir(), ".foundry", "keystores", requireEnv("DEPLOYER_KEYSTORE"));
  if (!existsSync(path)) {
    fail(`Keystore not found at ${path}. Create one with: cast wallet import <name> --interactive`);
  }
  const json = readFileSync(path, "utf8");
  const password = await prompt(`Keystore password (${path}): `, true);
  let privateKey: Hex;
  try {
    privateKey = (await decryptKeystoreJson(json, password)).privateKey as Hex;
  } catch {
    fail("Could not decrypt keystore — wrong password?");
  }
  const account = privateKeyToAccount(privateKey);
  if (COMPROMISED_ADDRESSES.has(account.address)) {
    fail(
      `Deployer ${account.address} is a known-compromised key. Generate a fresh deployer ` +
        `(README step 3) and fund it instead.`,
    );
  }
  return account;
}
