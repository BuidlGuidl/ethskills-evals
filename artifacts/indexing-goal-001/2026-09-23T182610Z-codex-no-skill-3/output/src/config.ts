import "dotenv/config";

import path from "node:path";
import { getAddress, isAddress, type Address } from "viem";
import { z } from "zod";

const envSchema = z.object({
  RPC_URL: z.string().min(1),
  STREAK_CONTRACT_ADDRESS: z.string().optional(),
  STREAK_START_BLOCK: z.coerce.bigint().default(0n),
  DATABASE_PATH: z.string().default("./data/streak.json"),
  PORT: z.coerce.number().int().positive().default(3000),
  INDEX_CHUNK_SIZE: z.coerce.bigint().default(2000n),
  INDEX_CONFIRMATIONS: z.coerce.bigint().default(2n),
  INDEX_POLL_MS: z.coerce.number().int().positive().default(12_000),
  CHAIN_ID: z.coerce.number().int().positive().default(8453),
  DISABLE_INDEXER: z
    .string()
    .optional()
    .transform((value) => value === "true" || value === "1"),
});

export type AppConfig = ReturnType<typeof loadConfig>;

export function loadConfig() {
  const env = envSchema.parse(process.env);
  const configuredAddress = env.STREAK_CONTRACT_ADDRESS;

  if (!configuredAddress || !isAddress(configuredAddress)) {
    throw new Error("STREAK_CONTRACT_ADDRESS must be set to the deployed contract address");
  }

  return {
    rpcUrl: env.RPC_URL,
    contractAddress: getAddress(configuredAddress) as Address,
    startBlock: env.STREAK_START_BLOCK,
    databasePath: path.resolve(env.DATABASE_PATH),
    port: env.PORT,
    chunkSize: env.INDEX_CHUNK_SIZE,
    confirmations: env.INDEX_CONFIRMATIONS,
    pollMs: env.INDEX_POLL_MS,
    chainId: env.CHAIN_ID,
    disableIndexer: env.DISABLE_INDEXER,
  };
}

export function loadDeployConfig() {
  const privateKey = process.env.PRIVATE_KEY;
  const rpcUrl = process.env.RPC_URL;
  const chainId = Number(process.env.CHAIN_ID ?? 8453);

  if (!rpcUrl) {
    throw new Error("RPC_URL is required");
  }

  if (!privateKey || !/^0x[0-9a-fA-F]{64}$/.test(privateKey)) {
    throw new Error("PRIVATE_KEY must be a 0x-prefixed 32-byte private key");
  }

  return { privateKey: privateKey as `0x${string}`, rpcUrl, chainId };
}
