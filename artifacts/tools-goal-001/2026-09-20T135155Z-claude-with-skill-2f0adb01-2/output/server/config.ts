import type { Network } from "@x402/core/types";

/**
 * Both supported deployments settle in USDC via the x402 `exact` scheme.
 * Base Sepolia is the default so you can exercise the full flow before
 * touching real money.
 */
const NETWORKS = {
  "base-sepolia": {
    network: "eip155:84532" as Network,
    usdc: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    blockscout: "https://base-sepolia.blockscout.com",
    explorer: "https://sepolia.basescan.org",
  },
  base: {
    network: "eip155:8453" as Network,
    usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    blockscout: "https://base.blockscout.com",
    explorer: "https://basescan.org",
  },
} as const;

export type ChainKey = keyof typeof NETWORKS;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var ${name}`);
  return value;
}

export function loadConfig() {
  const chain = (process.env.CHAIN ?? "base-sepolia") as ChainKey;
  const chainConfig = NETWORKS[chain];
  if (!chainConfig) {
    throw new Error(`CHAIN must be one of: ${Object.keys(NETWORKS).join(", ")}`);
  }

  const payTo = requireEnv("PAY_TO");
  if (!/^0x[0-9a-fA-F]{40}$/.test(payTo)) {
    throw new Error("PAY_TO must be a 0x-prefixed 20-byte address");
  }

  return {
    chain,
    ...chainConfig,
    port: Number(process.env.PORT ?? 4021),
    /** Where the USDC lands. Every settled call credits this address directly. */
    payTo,
    /** Human-readable price; the exact scheme converts it to USDC atomic units. */
    price: process.env.PRICE ?? "$0.02",
    /**
     * The public x402.org facilitator only settles testnets. Base mainnet
     * settlement requires the Coinbase CDP facilitator, which needs API keys.
     */
    cdpApiKeyId: process.env.CDP_API_KEY_ID,
    cdpApiKeySecret: process.env.CDP_API_KEY_SECRET,
  };
}

export type ServerConfig = ReturnType<typeof loadConfig>;
