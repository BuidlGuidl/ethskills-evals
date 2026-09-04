import "dotenv/config";
import { getAddress, isAddress, type Address, type Hex } from "viem";

/**
 * Environment loading. Two rules this file exists to enforce:
 *
 *  1. No secret has a default, a fallback, or a baked-in example value. If
 *     DEPLOYER_PRIVATE_KEY is missing the scripts stop; they never quietly
 *     sign with something else.
 *  2. Addresses are checksum-validated, because a sweep to a typo'd address
 *     is unrecoverable.
 */

class ConfigError extends Error {}

function required(name: string, hint: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new ConfigError(`${name} is not set. ${hint}`);
  }
  return value;
}

export function sepoliaRpcUrl(): string {
  return required(
    "SEPOLIA_RPC_URL",
    "Put your Sepolia JSON-RPC endpoint in .env (see .env.example).",
  );
}

/**
 * The one secret in the system. Read from the environment only — never a
 * literal in this repo, never a CLI argument (argv lands in your shell
 * history and in `ps` output).
 */
export function deployerPrivateKey(): Hex {
  const key = required(
    "DEPLOYER_PRIVATE_KEY",
    "Generate a fresh deploy key with `npm run new-deployer` and put it in .env.",
  );
  if (!/^0x[0-9a-fA-F]{64}$/.test(key)) {
    throw new ConfigError(
      "DEPLOYER_PRIVATE_KEY must be 0x followed by exactly 64 hex characters. " +
        "(Do not paste an address here — an address is 40 hex characters.)",
    );
  }
  return key as Hex;
}

/**
 * Read a public address from the environment.
 *
 * Mixed-case input is checked against EIP-55. All-lowercase (or all-uppercase)
 * input carries no checksum at all, so it is accepted but reported as
 * unverifiable — the caller shows that to the human before anything is signed.
 */
export function requiredAddress(
  name: string,
  hint: string,
): { address: Address; checksumVerified: boolean } {
  const raw = required(name, hint);

  if (!/^0x[0-9a-fA-F]{40}$/.test(raw)) {
    throw new ConfigError(`${name} is not a 20-byte address: ${raw}`);
  }

  const body = raw.slice(2);
  const caseless = body === body.toLowerCase() || body === body.toUpperCase();

  if (!caseless && !isAddress(raw)) {
    throw new ConfigError(
      `${name} has mixed case but fails its EIP-55 checksum: ${raw}\n` +
        `  If the bytes are right, the checksummed form is ${getAddress(raw)}.\n` +
        `  A failed checksum usually means a character was altered in transit. ` +
        `Confirm the address with its owner before using it.`,
    );
  }

  return { address: getAddress(raw), checksumVerified: !caseless };
}

export function optional(name: string): string | undefined {
  return process.env[name]?.trim() || undefined;
}

export function isConfigError(error: unknown): error is ConfigError {
  return error instanceof ConfigError;
}
