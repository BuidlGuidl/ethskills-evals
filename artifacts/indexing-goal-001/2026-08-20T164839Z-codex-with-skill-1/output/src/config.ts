import "dotenv/config";
import { getAddress, type Address } from "viem";

const required = (name: string) => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
};

export const config = {
  databaseUrl: required("DATABASE_URL"),
  rpcUrl: required("BASE_RPC_URL"),
  contractAddress: getAddress(required("STREAK_CONTRACT_ADDRESS")) as Address,
  startBlock: BigInt(required("STREAK_START_BLOCK")),
  confirmations: BigInt(process.env.CONFIRMATIONS ?? "12"),
  port: Number(process.env.PORT ?? "3000"),
};
