import "dotenv/config";
import type { Network } from "@x402/core/types";

/**
 * Two supported deployments. `base-sepolia` is the default so you can run the
 * whole loop end to end with testnet USDC and the free public facilitator.
 */
export type ChainKey = "base-sepolia" | "base";

type ChainInfo = {
  network: Network;
  chainId: number;
  /** Blockscout instance used to read the wallet activity we sell. */
  blockscout: string;
  /** Human label for USDC on this chain, used in logs and the README. */
  usdc: `0x${string}`;
};

export const CHAINS: Record<ChainKey, ChainInfo> = {
  "base-sepolia": {
    network: "eip155:84532",
    chainId: 84532,
    blockscout: "https://base-sepolia.blockscout.com",
    usdc: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  },
  base: {
    network: "eip155:8453",
    chainId: 8453,
    blockscout: "https://base.blockscout.com",
    usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  },
};

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var ${name}. See .env.example.`);
  return value;
}

export function chainKey(): ChainKey {
  const raw = process.env.CHAIN ?? "base-sepolia";
  if (raw !== "base" && raw !== "base-sepolia") {
    throw new Error(`CHAIN must be "base" or "base-sepolia", got "${raw}"`);
  }
  return raw;
}

export function chain(): ChainInfo {
  return CHAINS[chainKey()];
}

export const serverConfig = {
  port: Number(process.env.PORT ?? 4021),
  /** Where the money lands. Every settled call transfers USDC to this address. */
  payTo: () => requireEnv("PAY_TO_ADDRESS") as `0x${string}`,
  /** Price per call, as a USD string. The facilitator converts it to USDC units. */
  price: process.env.PRICE ?? "$0.02",
};

export const clientConfig = {
  privateKey: () => requireEnv("CLIENT_PRIVATE_KEY") as `0x${string}`,
  baseUrl: process.env.API_URL ?? `http://localhost:${process.env.PORT ?? 4021}`,
};
