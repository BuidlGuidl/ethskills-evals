import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  PAY_TO: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  X402_NETWORK: z.string().default("eip155:84532"),
  X402_PRICE: z.string().default("$0.02"),
  X402_FACILITATOR_URL: z.string().url().default("https://x402.org/facilitator"),
  BLOCKSCOUT_API_BASE: z
    .string()
    .url()
    .default("https://base-sepolia.blockscout.com/api/v2"),
});

export type NetworkId = `${string}:${string}`;

export const config = envSchema.parse(process.env) as z.infer<
  typeof envSchema
> & { X402_NETWORK: NetworkId };

export const paidRoute = "/v1/wallet-summary";
