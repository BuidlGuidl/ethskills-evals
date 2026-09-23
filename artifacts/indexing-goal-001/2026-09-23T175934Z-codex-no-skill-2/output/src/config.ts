import "dotenv/config";
import { getAddress, isAddress } from "viem";
import { z } from "zod";

const envSchema = z.object({
  STREAK_RPC_URL: z.string().url(),
  STREAK_CONTRACT_ADDRESS: z.string().refine(isAddress, "must be an EVM address"),
  STREAK_START_BLOCK: z.coerce.number().int().nonnegative(),
  STREAK_CONFIRMATIONS: z.coerce.number().int().nonnegative().default(4),
  STREAK_LOG_BATCH_SIZE: z.coerce.number().int().positive().default(5000),
  STREAK_DB_PATH: z.string().default(".data/streak-index.json"),
  PORT: z.coerce.number().int().positive().default(3000),
});

export type AppConfig = z.infer<typeof envSchema> & {
  STREAK_CONTRACT_ADDRESS: `0x${string}`;
};

export function loadConfig(): AppConfig {
  const parsed = envSchema.parse(process.env);
  return {
    ...parsed,
    STREAK_CONTRACT_ADDRESS: getAddress(
      parsed.STREAK_CONTRACT_ADDRESS,
    ) as `0x${string}`,
  };
}
