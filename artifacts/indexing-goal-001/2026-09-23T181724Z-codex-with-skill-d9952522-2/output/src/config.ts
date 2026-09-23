import "dotenv/config";
import { getAddress, isAddress } from "viem";
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  RPC_URL: z.string().url(),
  CONTRACT_ADDRESS: z.string().refine(isAddress, "CONTRACT_ADDRESS must be an EVM address"),
  START_BLOCK: z.coerce.bigint(),
  PORT: z.coerce.number().int().positive().default(3000),
  CONFIRMATIONS: z.coerce.bigint().default(6n),
  BLOCK_CHUNK_SIZE: z.coerce.bigint().default(5_000n),
  POLL_INTERVAL_MS: z.coerce.number().int().positive().default(12_000),
});

export type AppConfig = z.infer<typeof envSchema>;

export function loadConfig(): AppConfig {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Invalid environment:\n${parsed.error.issues.map((issue) => `- ${issue.path.join(".")}: ${issue.message}`).join("\n")}`);
  }

  return {
    ...parsed.data,
    CONTRACT_ADDRESS: getAddress(parsed.data.CONTRACT_ADDRESS),
  };
}

