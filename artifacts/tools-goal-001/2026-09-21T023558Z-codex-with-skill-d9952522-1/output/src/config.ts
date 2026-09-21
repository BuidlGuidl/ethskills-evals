import "dotenv/config";

import { createFacilitatorConfig } from "@coinbase/x402";
import type { FacilitatorConfig } from "@x402/core/http";
import { getAddress, isAddress } from "viem";

export const BASE_MAINNET = "eip155:8453" as const;
export const BASE_SEPOLIA = "eip155:84532" as const;

export type SupportedNetwork = typeof BASE_MAINNET | typeof BASE_SEPOLIA;

export function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function optionalEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value || undefined;
}

export function normalizeEnvAddress(name: string): `0x${string}` {
  const value = requireEnv(name);
  if (!isAddress(value)) {
    throw new Error(`${name} must be a valid EVM address`);
  }
  return getAddress(value) as `0x${string}`;
}

export function getPaymentNetwork(): SupportedNetwork {
  const network = optionalEnv("X402_NETWORK") ?? BASE_SEPOLIA;
  if (network !== BASE_MAINNET && network !== BASE_SEPOLIA) {
    throw new Error("X402_NETWORK must be eip155:84532 (Base Sepolia) or eip155:8453 (Base)");
  }
  return network;
}

export function getBlockscoutBaseUrl(network = getPaymentNetwork()): string {
  const override = optionalEnv("BLOCKSCOUT_BASE_URL");
  if (override) {
    return override.replace(/\/+$/, "");
  }
  return network === BASE_MAINNET
    ? "https://base.blockscout.com/api/v2"
    : "https://base-sepolia.blockscout.com/api/v2";
}

export function getNetworkName(network = getPaymentNetwork()): string {
  return network === BASE_MAINNET ? "Base" : "Base Sepolia";
}

export function getFacilitatorConfig(): FacilitatorConfig {
  const customUrl = optionalEnv("FACILITATOR_URL");
  if (customUrl) {
    return { url: customUrl };
  }

  return createFacilitatorConfig(
    requireEnv("CDP_API_KEY_ID"),
    requireEnv("CDP_API_KEY_SECRET"),
  );
}
