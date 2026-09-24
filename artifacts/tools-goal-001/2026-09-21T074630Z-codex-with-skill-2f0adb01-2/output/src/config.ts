import { config as loadEnv } from "dotenv";
import { getAddress, isAddress, type Address } from "viem";
import { z } from "zod";

loadEnv();

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  PAY_TO: z.string().optional(),
  PAYMENT_PRICE: z.string().default("$0.03"),
  X402_NETWORK: z.string().default("eip155:8453"),
  FACILITATOR_URL: z.string().url().default("https://facilitator.openx402.ai"),
  BLOCKSCOUT_BASE_URL: z.string().url().default("https://base.blockscout.com"),
  API_URL: z.string().url().default("http://localhost:3000/api/wallet-summary"),
  AGENT_PRIVATE_KEY: z.string().optional(),
  BASE_RPC_URL: z.string().url().default("https://mainnet.base.org"),
  MAX_USD_PER_CALL: z.coerce.number().positive().default(0.05),
});

export const env = envSchema.parse(process.env);

export function requireAddress(value: string | undefined, name: string): Address {
  if (!value || !isAddress(value)) {
    throw new Error(`${name} must be a valid EVM address`);
  }

  return getAddress(value);
}

export function requirePrivateKey(value: string | undefined, name: string): `0x${string}` {
  if (!value || !/^0x[0-9a-fA-F]{64}$/.test(value)) {
    throw new Error(`${name} must be a 32-byte hex private key prefixed with 0x`);
  }

  return value as `0x${string}`;
}
