import { config as loadEnv } from "dotenv";
import { isAddress } from "viem";
import { z } from "zod";

loadEnv();

const baseEnvSchema = z.object({
  NETWORK: z.string().regex(/^[a-z0-9]+:[a-zA-Z0-9]+$/, "NETWORK must be a CAIP-2 id").default("eip155:8453"),
});

const serverEnvSchema = baseEnvSchema.extend({
  PORT: z.coerce.number().int().positive().default(3000),
  PAY_TO_ADDRESS: z.string().refine(isAddress, "PAY_TO_ADDRESS must be an EVM address"),
  PRICE: z.string().default("$0.02"),
  MAX_TIMEOUT_SECONDS: z.coerce.number().int().positive().default(120),
  FACILITATOR_URL: z.string().url().default("https://facilitator.openx402.ai"),
  BLOCKSCOUT_BASE_URL: z.string().url().default("https://base.blockscout.com"),
});

const clientEnvSchema = baseEnvSchema.extend({
  API_URL: z.string().url().default("http://localhost:3000"),
  EVM_PRIVATE_KEY: z.string().regex(/^0x[a-fA-F0-9]{64}$/, "EVM_PRIVATE_KEY must be a 32-byte hex private key"),
  RPC_URL: z.string().url().optional(),
});

export function getServerEnv() {
  return serverEnvSchema.parse(process.env);
}

export function getClientEnv() {
  return clientEnvSchema.parse(process.env);
}
