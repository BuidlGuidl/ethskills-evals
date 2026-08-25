import { getAddress } from "viem";

export type Config = ReturnType<typeof loadConfig>;

function integer(name: string, fallback?: number) {
  const raw = process.env[name];
  if (raw === undefined && fallback !== undefined) return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${name} must be a non-negative integer`);
  return value;
}

export function loadConfig() {
  const rpcUrl = process.env.RPC_URL;
  const address = process.env.CONTRACT_ADDRESS;
  if (!rpcUrl) throw new Error("RPC_URL is required");
  if (!address) throw new Error("CONTRACT_ADDRESS is required");

  return {
    rpcUrl,
    address: getAddress(address),
    deploymentBlock: BigInt(integer("DEPLOYMENT_BLOCK")),
    confirmations: BigInt(integer("CONFIRMATIONS", 10)),
    pollIntervalMs: integer("POLL_INTERVAL_MS", 2_000),
    logChunkSize: BigInt(integer("LOG_CHUNK_SIZE", 5_000)),
    port: integer("PORT", 3_000),
    dbPath: process.env.DB_PATH ?? "data/streak.sqlite",
  };
}

