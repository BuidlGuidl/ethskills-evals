import type { Address } from "viem";

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

export const config = {
  rpcUrl: required("RPC_URL"),
  contract: required("CONTRACT_ADDRESS") as Address,
  startBlock: BigInt(required("START_BLOCK")),
  port: Number(process.env.PORT ?? 3000),
  dbPath: process.env.DB_PATH ?? "data/streak.sqlite",
  confirmations: BigInt(process.env.CONFIRMATIONS ?? 10),
  pollIntervalMs: Number(process.env.POLL_INTERVAL_MS ?? 4000)
};
