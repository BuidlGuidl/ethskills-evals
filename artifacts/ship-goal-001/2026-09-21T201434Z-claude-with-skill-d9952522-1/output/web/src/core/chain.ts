import { createPublicClient, http, type Address } from "viem";
import { base, baseSepolia, foundry } from "viem/chains";

/**
 * Chain wiring. One target chain per deployment, selected by NEXT_PUBLIC_CHAIN.
 * Base is the launch target — see the README for why.
 */

export type SupportedChainKey = "base" | "baseSepolia" | "foundry";

const CHAINS = { base, baseSepolia, foundry } as const;

/** Circle-issued native USDC. Addresses from Circle's official docs. */
const USDC_BY_CHAIN_ID: Record<number, Address> = {
  8453: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // Base mainnet
  84532: "0x036CbD53842c5426634e7929541eC2318f3dCF7e", // Base Sepolia
};

export const chainKey = (process.env.NEXT_PUBLIC_CHAIN ?? "baseSepolia") as SupportedChainKey;

export const chain = CHAINS[chainKey] ?? baseSepolia;

export const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL ?? chain.rpcUrls.default.http[0];

export const toolshedAddress = (process.env.NEXT_PUBLIC_TOOLSHED_ADDRESS ?? "") as Address;

export const usdcAddress: Address =
  (process.env.NEXT_PUBLIC_USDC_ADDRESS as Address | undefined) ??
  USDC_BY_CHAIN_ID[chain.id] ??
  ("" as Address);

export const USDC_DECIMALS = 6;

/** Block the Toolshed contract was deployed in; the indexer starts here. */
export const deployBlock = BigInt(process.env.TOOLSHED_DEPLOY_BLOCK ?? "0");

export const publicClient = createPublicClient({
  chain,
  transport: http(rpcUrl),
});

export function assertConfigured() {
  if (!toolshedAddress) throw new Error("NEXT_PUBLIC_TOOLSHED_ADDRESS is not set");
  if (!usdcAddress) throw new Error("USDC address unknown for this chain; set NEXT_PUBLIC_USDC_ADDRESS");
}

/** "12.50" -> 12500000n */
export function parseUsdc(input: string): bigint {
  const trimmed = input.trim();
  if (!/^\d+(\.\d{1,6})?$/.test(trimmed)) throw new Error(`Not a USDC amount: ${input}`);
  const [whole, frac = ""] = trimmed.split(".");
  return BigInt(whole) * 1_000_000n + BigInt(frac.padEnd(6, "0"));
}

/** 12500000n -> "12.50" */
export function formatUsdc(value: bigint | string): string {
  const v = typeof value === "string" ? BigInt(value) : value;
  const whole = v / 1_000_000n;
  const frac = (v % 1_000_000n).toString().padStart(6, "0").slice(0, 2);
  return `${whole}.${frac}`;
}
