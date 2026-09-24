import { config as loadEnv } from "dotenv";
import { isAddress } from "viem";
import { z } from "zod";

loadEnv();

export const SUPPORTED_PAYMENT_NETWORKS = ["eip155:8453", "eip155:84532"] as const;
export type SupportedPaymentNetwork = (typeof SUPPORTED_PAYMENT_NETWORKS)[number];

const addressSchema = z
  .string()
  .refine(value => isAddress(value), "must be a valid EVM address");

const networkSchema = z.enum(SUPPORTED_PAYMENT_NETWORKS);
const optionalUrlSchema = z.preprocess(
  value => (value === "" ? undefined : value),
  z.string().url().optional(),
);

const serverEnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  PAY_TO_ADDRESS: addressSchema,
  PAYMENT_PRICE: z.string().default("$0.02"),
  PAYMENT_NETWORK: networkSchema.default("eip155:84532"),
  CDP_API_KEY_ID: z.string().optional(),
  CDP_API_KEY_SECRET: z.string().optional(),
  FACILITATOR_URL: z.string().url().default("https://x402.org/facilitator"),
  BLOCKSCOUT_BASE_URL: optionalUrlSchema,
});

const clientEnvSchema = z.object({
  API_BASE_URL: z.string().url().default("http://localhost:3000"),
  CLIENT_PRIVATE_KEY: z.string().regex(/^0x[a-fA-F0-9]{64}$/, "must be a 32-byte hex private key"),
  PAYMENT_NETWORK: networkSchema.default("eip155:84532"),
});

export function readServerEnv() {
  return serverEnvSchema.parse(process.env);
}

export function readClientEnv() {
  return clientEnvSchema.parse(process.env);
}

export function blockscoutBaseUrl(network: SupportedPaymentNetwork, override?: string) {
  if (override) {
    return override.replace(/\/$/, "");
  }

  switch (network) {
    case "eip155:8453":
      return "https://base.blockscout.com";
    case "eip155:84532":
      return "https://base-sepolia.blockscout.com";
  }
}
