import "dotenv/config";
import { isAddress } from "viem";
import { z } from "zod";

const envSchema = z.object({
  RPC_URL: z.string().url(),
  CHAIN_ID: z.coerce.number().int().positive().default(8453),
  CONTRACT_ADDRESS: z
    .string()
    .refine((value) => isAddress(value), "CONTRACT_ADDRESS must be an EVM address"),
  START_BLOCK: z.coerce.bigint().nonnegative(),
  DATABASE_PATH: z.string().default("./data/streak.sqlite"),
  PORT: z.coerce.number().int().positive().default(3000),
  POLL_INTERVAL_MS: z.coerce.number().int().positive().default(12_000),
  CONFIRMATIONS: z.coerce.bigint().nonnegative().default(6n),
  MAX_BLOCK_RANGE: z.coerce.bigint().positive().default(5_000n),
});

export type AppConfig = z.infer<typeof envSchema>;

export function loadConfig(): AppConfig {
  return envSchema.parse(process.env);
}
