import "dotenv/config";
import type { Network } from "@x402/core/types";

/**
 * Both supported networks settle in USDC, which is the x402 default asset for
 * each of them — so the route can be priced in plain dollars ("$0.01").
 */
export const NETWORKS = {
  "base-sepolia": {
    network: "eip155:84532" as Network,
    chainId: 84532,
    usdc: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    blockscout: "https://base-sepolia.blockscout.com",
    explorer: "https://sepolia.basescan.org",
    defaultRpc: "https://sepolia.base.org",
  },
  base: {
    network: "eip155:8453" as Network,
    chainId: 8453,
    usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    blockscout: "https://base.blockscout.com",
    explorer: "https://basescan.org",
    defaultRpc: "https://mainnet.base.org",
  },
} as const;

export type NetworkKey = keyof typeof NETWORKS;

function readNetworkKey(): NetworkKey {
  const raw = process.env.X402_NETWORK ?? "base-sepolia";
  if (!(raw in NETWORKS)) {
    throw new Error(
      `X402_NETWORK must be one of ${Object.keys(NETWORKS).join(", ")}, got "${raw}"`,
    );
  }
  return raw as NetworkKey;
}

export const networkKey = readNetworkKey();
export const chain = NETWORKS[networkKey];

/** Price per call, as a dollar string the x402 EVM scheme converts to USDC units. */
export const PRICE = process.env.PRICE ?? "$0.01";

export const PORT = Number(process.env.PORT ?? 4021);

export const RPC_URL = process.env.RPC_URL ?? chain.defaultRpc;
