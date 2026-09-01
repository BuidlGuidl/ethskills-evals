import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import "dotenv/config";
import {
  createPublicClient,
  createWalletClient,
  formatEther,
  http,
  getAddress,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";

/**
 * The team account that leftover Sepolia ETH is swept back to.
 *
 * Stored in EIP-55 checksummed form on purpose: the mixed casing is a
 * checksum over the address bytes, so a single mistyped character makes
 * `getAddress` throw instead of silently sending funds into a black hole.
 */
export const TEAM_ACCOUNT: Address = getAddress(
  "0xfB047366a183DDEF3F40ff3e4ebf34f8d01FD3Fc",
);

/** Sepolia's chain id. Every script refuses to run against anything else. */
const EXPECTED_CHAIN_ID = sepolia.id; // 11155111

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing ${name}. Copy .env.example to .env and fill it in (see README.md).`,
    );
  }
  return value;
}

function readPrivateKey(): Hex {
  const raw = required("DEPLOYER_PRIVATE_KEY").trim();
  const key = raw.startsWith("0x") ? raw : `0x${raw}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(key)) {
    throw new Error(
      "DEPLOYER_PRIVATE_KEY is not a 32-byte hex private key (expected 0x + 64 hex chars).",
    );
  }
  return key as Hex;
}

export function publicClient() {
  return createPublicClient({
    chain: sepolia,
    transport: http(required("SEPOLIA_RPC_URL")),
  });
}

export function deployer() {
  const account = privateKeyToAccount(readPrivateKey());
  const wallet = createWalletClient({
    account,
    chain: sepolia,
    transport: http(required("SEPOLIA_RPC_URL")),
  });
  return { account, wallet };
}

/**
 * Ask the RPC what chain it is actually on. An RPC URL pointing at the wrong
 * network is the cheapest way to spend real ETH by accident, so we check
 * rather than trust the variable name.
 */
export async function assertSepolia(client: ReturnType<typeof publicClient>) {
  const chainId = await client.getChainId();
  if (chainId !== EXPECTED_CHAIN_ID) {
    throw new Error(
      `SEPOLIA_RPC_URL is connected to chain ${chainId}, not Sepolia (${EXPECTED_CHAIN_ID}). ` +
        `Refusing to send a transaction. These scripts are testnet-only.`,
    );
  }
}

export const eth = (wei: bigint) => `${formatEther(wei)} ETH`;

export const explorerTx = (hash: Hex) => `https://sepolia.etherscan.io/tx/${hash}`;
export const explorerAddress = (address: Address) =>
  `https://sepolia.etherscan.io/address/${address}`;

/**
 * Human gate. Nothing that spends funds goes out without the numbers on
 * screen and a person agreeing to them.
 *
 * `--yes` pre-authorises the run for non-interactive use. It is still a human
 * decision — it just happens at the shell prompt instead of at this line.
 * Do not wire a `--yes` sweep into CI; see README.md.
 */
export async function confirm(question: string): Promise<boolean> {
  if (process.argv.includes("--yes") || process.argv.includes("-y")) {
    console.log(`${question} (pre-authorised with --yes)`);
    return true;
  }
  if (!stdin.isTTY) {
    console.error(
      `${question}\nNo terminal attached and --yes was not passed. Aborting.`,
    );
    return false;
  }
  const rl = createInterface({ input: stdin, output: stdout });
  try {
    const answer = await rl.question(`${question} Type "yes" to continue: `);
    return answer.trim().toLowerCase() === "yes";
  } finally {
    rl.close();
  }
}
