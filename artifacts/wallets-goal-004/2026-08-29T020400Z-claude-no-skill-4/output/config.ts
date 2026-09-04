import "dotenv/config";
import { privateKeyToAccount } from "viem/accounts";
import {
  BaseError,
  getAddress,
  isAddress,
  isHex,
  type Address,
  type Hex,
} from "viem";
import { sepolia } from "viem/chains";
import { createPublicClient, createWalletClient, http } from "viem";
import type { PrivateKeyAccount, PublicClient, WalletClient } from "viem";

/**
 * Shared setup for deploy.ts and sweep.ts.
 *
 * Everything sensitive comes from .env, which is gitignored. Nothing in this
 * repo should ever contain a private key literal.
 */

export const chain = sepolia;

/** Block explorer base URL, used to print clickable links. */
export const explorer = "https://sepolia.etherscan.io";

class ConfigError extends Error {}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new ConfigError(
      `Missing ${name}. Copy .env.example to .env and fill it in.`,
    );
  }
  return value;
}

/** The account that pays for and owns the deployment. */
export function deployerAccount(): PrivateKeyAccount {
  const raw = required("DEPLOYER_PRIVATE_KEY");
  const key = (raw.startsWith("0x") ? raw : `0x${raw}`) as Hex;

  if (!isHex(key) || key.length !== 66) {
    throw new ConfigError(
      "DEPLOYER_PRIVATE_KEY must be a 0x-prefixed 32-byte hex string " +
        `(66 characters including the 0x). Got ${key.length} characters. ` +
        "Note this is a private key, not an account address — an address is " +
        "only 42 characters. Run `npm run new-key` to generate one.",
    );
  }

  return privateKeyToAccount(key);
}

/** Where sweep.ts returns leftover Sepolia ETH. */
export function teamAccount(): Address {
  const value = required("TEAM_ACCOUNT");

  // Accept any casing, then normalise to EIP-55. If the caller supplied a
  // mixed-case address whose checksum does not match, say so loudly: that is
  // the one signal we get that an address was mistyped or mis-transcribed.
  if (!isAddress(value, { strict: false })) {
    throw new ConfigError(`TEAM_ACCOUNT is not a valid address: ${value}`);
  }
  const address = getAddress(value.toLowerCase());
  const isMixedCase = value !== value.toLowerCase() && value !== value.toUpperCase();
  if (isMixedCase && value !== address) {
    console.warn(
      `\nWarning: TEAM_ACCOUNT ${value} does not match its EIP-55 checksum.\n` +
        `  Interpreting it as ${address}.\n` +
        `  Confirm this is the right account before sending funds — transfers ` +
        `cannot be undone.\n`,
    );
  }
  return address;
}

export function publicClient(): PublicClient {
  return createPublicClient({
    chain,
    transport: http(required("SEPOLIA_RPC_URL")),
  });
}

export function walletClient(account: PrivateKeyAccount): WalletClient {
  return createWalletClient({
    account,
    chain,
    transport: http(required("SEPOLIA_RPC_URL")),
  });
}

/**
 * Print failures as a readable message rather than a stack trace or a wall of
 * viem internals, so a teammate hitting a missing .env or an underfunded
 * account gets something actionable. Set DEBUG=1 for the full error.
 */
export function reportAndExit(error: unknown): never {
  if (process.env.DEBUG) {
    console.error(error);
    process.exit(1);
  }
  if (error instanceof ConfigError) {
    console.error(`\nConfiguration error: ${error.message}\n`);
  } else if (error instanceof BaseError) {
    console.error(`\n${error.shortMessage}`);
    if (error.metaMessages?.length) {
      console.error(error.metaMessages.slice(0, 3).join("\n"));
    }
    console.error("\nRe-run with DEBUG=1 for the full error.\n");
  } else if (error instanceof Error) {
    console.error(`\n${error.message}\n`);
  } else {
    console.error(error);
  }
  process.exit(1);
}
