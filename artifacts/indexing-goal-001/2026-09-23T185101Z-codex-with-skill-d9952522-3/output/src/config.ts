import "dotenv/config";
import { getAddress, isAddress, type Address } from "viem";
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  PORT: z.coerce.number().int().positive().default(8787),
  RPC_URL: z.string().url(),
  CHAIN_ID: z.coerce.number().int().positive().default(8453),
  STREAK_CONTRACT_ADDRESS: z.string(),
  STREAK_DEPLOYMENT_BLOCK: z.coerce.number().int().nonnegative(),
  RPC_BLOCK_RANGE: z.coerce.number().int().positive().default(2_000),
  FINALITY_BLOCKS: z.coerce.number().int().nonnegative().default(20),
  INDEXER_POLL_MS: z.coerce.number().int().positive().default(12_000),
});

export type AppConfig = z.infer<typeof envSchema> & {
  STREAK_CONTRACT_ADDRESS: Address;
};

export function loadConfig(): AppConfig {
  const parsed = envSchema.parse(process.env);
  if (!isAddress(parsed.STREAK_CONTRACT_ADDRESS)) {
    throw new Error("STREAK_CONTRACT_ADDRESS must be a valid EVM address");
  }

  return {
    ...parsed,
    STREAK_CONTRACT_ADDRESS: getAddress(parsed.STREAK_CONTRACT_ADDRESS),
  };
}
