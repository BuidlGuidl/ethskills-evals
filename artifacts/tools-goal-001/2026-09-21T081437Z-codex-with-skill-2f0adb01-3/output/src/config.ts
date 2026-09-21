import "dotenv/config";
import { isAddress } from "viem";
import type { Network } from "@x402/core/types";

export type HexAddress = `0x${string}`;

export const PAID_ROUTE = "GET /v1/wallets/:address/activity-summary";

export function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function requireAddress(value: string, label: string): HexAddress {
  if (!isAddress(value)) {
    throw new Error(`${label} must be a valid EVM address`);
  }
  return value as HexAddress;
}

export function normalizeAddress(value: string, label = "address"): HexAddress {
  return requireAddress(value, label);
}

export const serverConfig = {
  port: Number(process.env.PORT ?? 3000),
  payTo: () => requireAddress(requiredEnv("PAY_TO_ADDRESS"), "PAY_TO_ADDRESS"),
  price: process.env.X402_PRICE ?? "$0.03",
  network: (process.env.X402_NETWORK ?? "eip155:84532") as Network,
  facilitatorUrl: process.env.X402_FACILITATOR_URL ?? "https://x402.org/facilitator",
  blockscoutBaseUrl:
    process.env.BLOCKSCOUT_BASE_URL ?? "https://base.blockscout.com/api/v2",
  blockscoutApiKey: process.env.BLOCKSCOUT_API_KEY,
};

export const clientConfig = {
  apiBaseUrl: process.env.API_BASE_URL ?? "http://localhost:3000",
  privateKey: () => requiredEnv("AGENT_PRIVATE_KEY") as `0x${string}`,
  network: (process.env.X402_NETWORK ?? "eip155:84532") as Network,
  maxPayment: process.env.X402_MAX_PAYMENT ?? "$0.10",
};
