import "dotenv/config";
import { facilitator as cdpFacilitator } from "@coinbase/x402";
import type { FacilitatorConfig, Network } from "x402/types";
import { base, baseSepolia } from "viem/chains";

/** The two networks this service is wired for. Everything else is a config error. */
export type SupportedNetwork = Extract<Network, "base" | "base-sepolia">;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var ${name}. See .env.example.`);
  return value;
}

export function resolveNetwork(): SupportedNetwork {
  const raw = process.env.NETWORK ?? "base-sepolia";
  if (raw !== "base" && raw !== "base-sepolia") {
    throw new Error(`NETWORK must be "base" or "base-sepolia", got "${raw}".`);
  }
  return raw;
}

export const chainFor = (network: SupportedNetwork) => (network === "base" ? base : baseSepolia);

/**
 * Picks the facilitator that verifies and settles payments.
 *
 * Testnet runs against the public x402.org facilitator, which needs no credentials.
 * Base mainnet has no free public facilitator, so it requires CDP API keys.
 */
export function resolveFacilitator(network: SupportedNetwork): FacilitatorConfig | undefined {
  if (network === "base-sepolia") return undefined; // x402-express defaults to x402.org/facilitator
  requireEnv("CDP_API_KEY_ID");
  requireEnv("CDP_API_KEY_SECRET");
  return cdpFacilitator;
}

export const serverConfig = () => {
  const network = resolveNetwork();
  const payTo = requireEnv("ADDRESS_TO_PAY");
  if (!/^0x[0-9a-fA-F]{40}$/.test(payTo)) {
    throw new Error(`ADDRESS_TO_PAY is not a valid EVM address: ${payTo}`);
  }
  return {
    network,
    payTo: payTo as `0x${string}`,
    port: Number(process.env.PORT ?? 4021),
    price: process.env.PRICE ?? "$0.02",
    facilitator: resolveFacilitator(network),
    rpcUrl: process.env.RPC_URL,
  };
};
