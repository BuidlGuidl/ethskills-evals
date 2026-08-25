import "dotenv/config";
import { getAddress, type Address } from "viem";
import type { IndexerConfig } from "./indexer.js";

export function loadConfig(): IndexerConfig & { databasePath: string; port: number } {
  const rpcUrl = process.env.BASE_RPC_URL;
  const rawAddress = process.env.STREAK_CONTRACT_ADDRESS;
  const deploymentBlock = Number(process.env.STREAK_DEPLOYMENT_BLOCK);
  if (!rpcUrl || !rawAddress || !Number.isSafeInteger(deploymentBlock) || deploymentBlock < 0) {
    throw new Error("Set BASE_RPC_URL, STREAK_CONTRACT_ADDRESS, and a non-negative STREAK_DEPLOYMENT_BLOCK in .env");
  }
  return { rpcUrl, contractAddress: getAddress(rawAddress) as Address, deploymentBlock, databasePath: process.env.DATABASE_PATH ?? "./data/streak.sqlite", port: Number(process.env.PORT ?? 3000) };
}
