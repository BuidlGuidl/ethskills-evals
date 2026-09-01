import { getAddress, isAddress, isHex, type Address, type Hex } from "viem";

/**
 * Reads and validates configuration from the environment.
 *
 * Secrets are only ever read from the environment (populated from .env, which
 * is gitignored). Nothing in this repo should contain a private key.
 */

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `Missing ${name}. Copy .env.example to .env and fill it in (see README.md).`,
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

export function deployerPrivateKey(): Hex {
  const key = required("DEPLOYER_PRIVATE_KEY");

  if (!isHex(key) || key.length !== 66) {
    // Deliberately does not echo the value: a bad key is still a secret.
    throw new Error(
      "DEPLOYER_PRIVATE_KEY must be 0x followed by 64 hex characters. " +
        "A 40-hex-character value is an *address*, not a key — those are not interchangeable.",
    );
  }
  return key;
}

export function teamAccount(): Address {
  const value = required("TEAM_ACCOUNT");

  // strict: false accepts any casing. We then normalise to the EIP-55
  // checksummed form, which is what we log and send to.
  if (!isAddress(value, { strict: false })) {
    throw new Error(`TEAM_ACCOUNT is not a valid address: ${value}`);
  }
  const checksummed = getAddress(value);

  // A mixed-case address that fails EIP-55 usually means it was retyped or
  // hand-edited. The checksum can no longer vouch for the digits, so say so.
  const isMixedCase = value !== value.toLowerCase() && value !== value.toUpperCase();
  if (isMixedCase && value !== checksummed) {
    console.warn(
      `⚠️  TEAM_ACCOUNT has an invalid EIP-55 checksum, so a typo in it cannot be\n` +
        `    detected automatically. Confirm the digits against a trusted source.\n` +
        `      given: ${value}\n` +
        `      using: ${checksummed}\n`,
    );
  }
  return checksummed;
}

export function contractName(): string {
  return process.env.CONTRACT_NAME?.trim() || "Counter";
}
