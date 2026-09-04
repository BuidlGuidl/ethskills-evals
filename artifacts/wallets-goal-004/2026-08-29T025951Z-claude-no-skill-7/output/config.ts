import "dotenv/config";
import {
  createPublicClient,
  createWalletClient,
  getAddress,
  http,
  isAddress,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";

/**
 * Shared setup for deploy.ts and sweep.ts.
 *
 * Every secret comes from the environment (.env, which is gitignored, or real
 * env vars in CI). Nothing sensitive is ever hardcoded in this repo.
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(`Missing ${name}. Copy .env.example to .env and fill it in.`);
  }
  return value.trim();
}

function privateKey(): Hex {
  const key = required("DEPLOYER_PRIVATE_KEY");
  if (!/^0x[0-9a-fA-F]{64}$/.test(key)) {
    throw new Error("DEPLOYER_PRIVATE_KEY must be 0x followed by 64 hex characters.");
  }
  return key as Hex;
}

export function teamAddress(): Address {
  const value = required("TEAM_ADDRESS");
  if (!isAddress(value, { strict: false })) {
    throw new Error(`TEAM_ADDRESS is not a valid address: ${value}`);
  }
  const checksummed = getAddress(value.toLowerCase());
  // A mixed-case address that doesn't match EIP-55 can't be checksum-verified,
  // so a typo in it would go undetected. Warn rather than reject: the casing is
  // often just lost in copy/paste, and the bytes are what actually get used.
  if (value !== value.toLowerCase() && value !== checksummed) {
    console.warn(
      `Warning: TEAM_ADDRESS failed its EIP-55 checksum. Confirm the address out of band ` +
        `before sending anything to it.\n  given:       ${value}\n  checksummed: ${checksummed}`,
    );
  }
  return checksummed;
}

export const account = privateKeyToAccount(privateKey());

const transport = http(required("SEPOLIA_RPC_URL"));

export const publicClient = createPublicClient({ chain: sepolia, transport });

export const walletClient = createWalletClient({ account, chain: sepolia, transport });

/** Fail early with a clear message if the RPC URL points at the wrong network. */
export async function assertSepolia(): Promise<void> {
  const chainId = await publicClient.getChainId();
  if (chainId !== sepolia.id) {
    throw new Error(
      `SEPOLIA_RPC_URL is connected to chain ${chainId}, expected ${sepolia.id} (Sepolia).`,
    );
  }
}

export function explorer(path: string): string {
  return `${sepolia.blockExplorers.default.url}/${path}`;
}
