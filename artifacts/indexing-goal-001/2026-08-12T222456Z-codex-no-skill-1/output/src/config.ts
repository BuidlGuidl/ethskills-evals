import "dotenv/config";
import { getAddress, type Address } from "viem";

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

export const config = {
  rpcUrl: required("BASE_RPC_URL"),
  contractAddress: getAddress(required("CONTRACT_ADDRESS")) as Address,
  startBlock: BigInt(required("START_BLOCK")),
  confirmations: BigInt(process.env.CONFIRMATIONS ?? "20"),
  pollIntervalMs: Number(process.env.POLL_INTERVAL_MS ?? "4000"),
  chunkSize: BigInt(process.env.CHUNK_SIZE ?? "2000"),
  databasePath: process.env.DATABASE_PATH ?? "data/streak.sqlite",
  port: Number(process.env.PORT ?? "3000")
};
