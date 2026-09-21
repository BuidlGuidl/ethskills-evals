import "dotenv/config";
import { isAddress } from "viem";
import { z } from "zod";

export type CaipNetwork = `${string}:${string}`;

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  PAY_TO_ADDRESS: z.string().optional(),
  PRICE_PER_CALL: z.string().default("$0.01"),
  PAYMENT_NETWORK: z.string().default("eip155:84532"),
  FACILITATOR_URL: z.string().url().default("https://facilitator.openx402.ai"),
  BLOCKSCOUT_BASE_URL: z.string().url().default("https://base.blockscout.com/api/v2"),
  BLOCKSCOUT_API_KEY: z.string().optional(),
  API_BASE_URL: z.string().url().default("http://localhost:3000"),
  AGENT_PRIVATE_KEY: z.string().optional(),
  MAX_PAYMENT_PER_CALL: z.string().default("$0.05")
});

export const env = envSchema.parse(process.env);

export function requireAddress(name: string, value: string | undefined): `0x${string}` {
  if (!value || !isAddress(value)) {
    throw new Error(`${name} must be set to a valid EVM address`);
  }

  return value as `0x${string}`;
}

export function requirePrivateKey(name: string, value: string | undefined): `0x${string}` {
  if (!value || !/^0x[0-9a-fA-F]{64}$/.test(value)) {
    throw new Error(`${name} must be set to a 32-byte hex private key`);
  }

  return value as `0x${string}`;
}

export function requireNetwork(name: string, value: string): CaipNetwork {
  if (!/^[a-z0-9-]+:[a-zA-Z0-9-]+$/.test(value)) {
    throw new Error(`${name} must be a CAIP-2 network id like eip155:8453`);
  }

  return value as CaipNetwork;
}
