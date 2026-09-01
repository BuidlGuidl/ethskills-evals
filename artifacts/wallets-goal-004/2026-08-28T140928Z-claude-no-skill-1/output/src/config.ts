import { config as loadDotenv } from "dotenv";
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

loadDotenv({ quiet: true });

/** Fallback team account, overridable with TEAM_ADDRESS in .env. */
const DEFAULT_TEAM_ADDRESS = "0xfB047366a183DDEF3F40ff3e4ebf34f8d01FD3Fc";

/** Public Sepolia RPC. Fine for a smoke test, rate-limited for real work. */
const DEFAULT_RPC_URL = "https://rpc.sepolia.org";

const PRIVATE_KEY_RE = /^0x[0-9a-fA-F]{64}$/;

/** An expected, user-fixable failure: printed as a message, not a stack trace. */
export class UserError extends Error {}

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new UserError(
      `${name} is not set. Copy .env.example to .env and fill it in.`,
    );
  }
  return value;
}

function readPrivateKey(): Hex {
  const key = required("DEPLOYER_PRIVATE_KEY").trim();
  if (!PRIVATE_KEY_RE.test(key)) {
    throw new UserError(
      "DEPLOYER_PRIVATE_KEY must be 0x followed by 64 hex characters. " +
        "(A 40-character value is an address, not a private key.)",
    );
  }
  return key as Hex;
}

function readTeamAddress(): Address {
  const raw = (process.env.TEAM_ADDRESS ?? DEFAULT_TEAM_ADDRESS).trim();

  // strict: false accepts any casing; we checksum it ourselves below. A bad
  // EIP-55 checksum is worth a warning (it usually means the address was
  // retyped by hand) but not a hard failure — the 20 bytes are unambiguous.
  if (!isAddress(raw, { strict: false })) {
    throw new UserError(`TEAM_ADDRESS is not a valid address: ${raw}`);
  }
  const checksummed = getAddress(raw);
  const mixedCase = raw !== raw.toLowerCase() && raw !== raw.toUpperCase();
  if (mixedCase && raw !== checksummed) {
    console.warn(
      `⚠ TEAM_ADDRESS ${raw} has an invalid EIP-55 checksum.\n` +
        `  Using ${checksummed}. Double-check it before sending funds.`,
    );
  }
  return checksummed;
}

export function loadConfig() {
  const rpcUrl = process.env.SEPOLIA_RPC_URL?.trim() || DEFAULT_RPC_URL;
  const account = privateKeyToAccount(readPrivateKey());
  const transport = http(rpcUrl);

  return {
    rpcUrl,
    account,
    teamAddress: readTeamAddress(),
    publicClient: createPublicClient({ chain: sepolia, transport }),
    walletClient: createWalletClient({ account, chain: sepolia, transport }),
  };
}

export type Config = ReturnType<typeof loadConfig>;

/**
 * Refuse to run against anything but Sepolia. Cheap insurance against a
 * mainnet RPC URL ending up in .env — these scripts move real value.
 */
export async function assertSepolia(config: Config): Promise<void> {
  const chainId = await config.publicClient.getChainId();
  if (chainId !== sepolia.id) {
    throw new UserError(
      `SEPOLIA_RPC_URL points at chain ${chainId}, expected Sepolia (${sepolia.id}). ` +
        "Refusing to continue.",
    );
  }
}

/** Print a friendly message for expected failures, a stack trace otherwise. */
export function reportFatal(error: unknown): never {
  if (error instanceof UserError) {
    console.error(`\n✗ ${error.message}\n`);
  } else {
    console.error(error);
  }
  process.exit(1);
}

export { sepolia };
