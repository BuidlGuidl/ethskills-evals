/** Shared network/config helpers for the server and the client. */

export type Caip2 = `${string}:${string}`;

export const NETWORKS = {
  "base-sepolia": {
    caip2: "eip155:84532" as Caip2,
    chainId: 84532,
    blockscout: "https://base-sepolia.blockscout.com",
    /** Public x402 Foundation facilitator — testnet only, no API keys. */
    facilitatorUrl: "https://x402.org/facilitator",
  },
  base: {
    caip2: "eip155:8453" as Caip2,
    chainId: 8453,
    blockscout: "https://base.blockscout.com",
    /** Mainnet settles through the Coinbase CDP facilitator (needs CDP keys). */
    facilitatorUrl: undefined,
  },
} as const;

export type NetworkName = keyof typeof NETWORKS;

export function resolveNetwork(name = process.env.NETWORK ?? "base-sepolia") {
  const net = NETWORKS[name as NetworkName];
  if (!net) {
    throw new Error(`NETWORK must be one of: ${Object.keys(NETWORKS).join(", ")} (got "${name}")`);
  }
  return { name: name as NetworkName, ...net };
}

export function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required env var ${key} — see .env.example`);
  return value;
}
