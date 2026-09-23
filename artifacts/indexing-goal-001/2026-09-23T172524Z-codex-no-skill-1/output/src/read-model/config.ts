import "dotenv/config";
import { isAddress, type Address } from "viem";

export type AppConfig = {
  rpcUrl: string;
  contractAddress: Address;
  startBlock: bigint;
  confirmations: bigint;
  batchSize: bigint;
  pollMs: number;
  dataFile: string;
  port: number;
};

export function loadConfig(env = process.env): AppConfig {
  const rpcUrl = required(env.RPC_URL, "RPC_URL");
  const contractAddress = required(env.STREAK_CONTRACT_ADDRESS, "STREAK_CONTRACT_ADDRESS");

  if (!isAddress(contractAddress)) {
    throw new Error("STREAK_CONTRACT_ADDRESS must be a valid EVM address");
  }

  return {
    rpcUrl,
    contractAddress,
    startBlock: BigInt(env.STREAK_START_BLOCK ?? "0"),
    confirmations: BigInt(env.STREAK_CONFIRMATIONS ?? "4"),
    batchSize: BigInt(env.STREAK_BATCH_SIZE ?? "50000"),
    pollMs: Number(env.STREAK_POLL_MS ?? "12000"),
    dataFile: env.STREAK_DATA_FILE ?? ".streak-data/read-model.json",
    port: Number(env.PORT ?? "3000")
  };
}

function required(value: string | undefined, name: string): string {
  if (value === undefined || value.trim() === "") {
    throw new Error(`${name} is required`);
  }

  return value;
}
