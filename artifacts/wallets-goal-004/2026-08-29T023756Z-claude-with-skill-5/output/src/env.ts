import "dotenv/config";
import { isAddress, getAddress, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";

/**
 * Addresses whose private key is known to be exposed. The deploy key that was
 * circulated in project chat during local testing lives here so nobody
 * accidentally funds it again. Add to this list, never remove from it.
 */
const BURNED_ACCOUNTS: Record<string, string> = {
  "0x6Ed090E7EBd28B191810eaBc9b2c31B9660A2402":
    "its private key was pasted into a chat message on 2026-08-28",
};

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `${name} is not set. Copy .env.example to .env and fill it in.`,
    );
  }
  return value;
}

export function rpcUrl(): string {
  const url = required("SEPOLIA_RPC_URL");
  if (!/^https?:\/\//.test(url)) {
    throw new Error(`SEPOLIA_RPC_URL must be an http(s) URL, got: ${url}`);
  }
  return url;
}

/**
 * Reads an address and returns it checksummed.
 *
 * A mixed-case address carries an EIP-55 checksum, which is the only thing
 * standing between a mistyped hex digit and funds sent into a hole. If the
 * checksum does not match we refuse it rather than normalising the typo away.
 * All-lowercase and all-uppercase addresses carry no checksum, so they are
 * accepted and checksummed here.
 */
export function address(name: string): Address {
  const value = required(name);
  if (!isAddress(value, { strict: false })) {
    throw new Error(`${name} is not a valid address: ${value}`);
  }
  const hasChecksum = value !== value.toLowerCase() && value !== value.toUpperCase();
  const checksummed = getAddress(value.toLowerCase());
  if (hasChecksum && value !== checksummed) {
    throw new Error(
      `${name} fails its EIP-55 checksum:\n` +
        `  given:    ${value}\n` +
        `  expected: ${checksummed}\n` +
        `Those are the same 20 bytes, so the casing was mangled somewhere in ` +
        `transit — but a mangled address is also what a single mistyped hex ` +
        `digit looks like. Re-copy it from the source of truth before using it.`,
    );
  }
  return checksummed;
}

/**
 * Loads the deployer key from the environment. There is deliberately no
 * default and no fallback: if DEPLOYER_PRIVATE_KEY is unset, these scripts
 * refuse to run rather than signing with something baked into the repo.
 */
export function deployerAccount() {
  const key = required("DEPLOYER_PRIVATE_KEY");
  if (!/^0x[0-9a-fA-F]{64}$/.test(key)) {
    throw new Error(
      "DEPLOYER_PRIVATE_KEY must be 0x-prefixed and 32 bytes (64 hex chars).",
    );
  }
  const account = privateKeyToAccount(key as Hex);

  const burned = BURNED_ACCOUNTS[account.address];
  if (burned) {
    throw new Error(
      `Refusing to sign with ${account.address}: ${burned}.\n` +
        `Generate a fresh key with \`npm run new-key\`, fund it, and move any ` +
        `remaining balance off the old account by hand.`,
    );
  }
  return account;
}
