import "dotenv/config";
import { base, baseSepolia } from "viem/chains";

export type SupportedNetwork = "base" | "base-sepolia";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var ${name} (see .env.example)`);
  return value;
}

export const NETWORK = (process.env.NETWORK ?? "base-sepolia") as SupportedNetwork;

if (NETWORK !== "base" && NETWORK !== "base-sepolia") {
  throw new Error(`NETWORK must be "base" or "base-sepolia", got "${NETWORK}"`);
}

export const CHAIN = NETWORK === "base" ? base : baseSepolia;
export const RPC_URL = process.env.BASE_RPC_URL || CHAIN.rpcUrls.default.http[0];
export const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY;

export const serverConfig = {
  port: Number(process.env.PORT ?? 4021),
  payTo: required("PAY_TO_ADDRESS") as `0x${string}`,
  price: process.env.PRICE ?? "$0.02",
};

export const clientConfig = {
  privateKey: () => required("CLIENT_PRIVATE_KEY"),
  apiUrl: process.env.API_URL ?? "http://localhost:4021",
};
