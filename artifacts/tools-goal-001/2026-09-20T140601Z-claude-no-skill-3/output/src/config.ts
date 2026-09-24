/**
 * Central config. Reads .env (if present) without a dotenv dependency --
 * Node >= 20.12 ships process.loadEnvFile().
 */
import { existsSync } from "node:fs";

if (existsSync(".env")) {
  process.loadEnvFile(".env");
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var ${name}. Copy .env.example to .env and fill it in.`);
  }
  return value;
}

/** "base-sepolia" for testing, "base" for real money. */
export const NETWORK = (process.env.NETWORK ?? "base-sepolia") as "base" | "base-sepolia";

export const IS_MAINNET = NETWORK === "base";

/** USDC contract that payments settle in, per network. */
export const USDC_ADDRESS = IS_MAINNET
  ? "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
  : "0x036CbD53842c5426634e7929541eC2318f3dCF7e";

export const RPC_URL =
  process.env.RPC_URL ?? (IS_MAINNET ? "https://mainnet.base.org" : "https://sepolia.base.org");

/** Etherscan V2 works across chains with one key; optional but gives much richer summaries. */
export const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY ?? "";
export const CHAIN_ID = IS_MAINNET ? 8453 : 84532;

export const PORT = Number(process.env.PORT ?? 4021);

export function serverConfig() {
  return {
    /** Your address. Every payment lands here directly -- no custodian in the path. */
    payTo: required("PAY_TO_ADDRESS") as `0x${string}`,
    /** Price per call, quoted in USD and charged in USDC. */
    price: process.env.PRICE ?? "$0.01",
  };
}

export function clientConfig() {
  return {
    privateKey: required("CLIENT_PRIVATE_KEY"),
    baseUrl: process.env.API_BASE_URL ?? `http://localhost:${PORT}`,
  };
}
