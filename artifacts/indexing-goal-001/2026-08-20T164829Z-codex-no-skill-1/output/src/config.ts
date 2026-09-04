import "dotenv/config";
import { getAddress } from "viem";

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

export const config = {
  rpcUrl: required("BASE_RPC_URL"),
  contractAddress: getAddress(required("STREAK_CONTRACT_ADDRESS")),
  deploymentBlock: BigInt(required("STREAK_DEPLOYMENT_BLOCK")),
  port: Number(process.env.PORT ?? 3000),
};
