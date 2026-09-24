import "dotenv/config";
import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";
import { z } from "zod";

const envSchema = z.object({
  AGENT_PRIVATE_KEY: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  API_URL: z.string().url().default("http://localhost:3000/v1/wallet-summary"),
  WALLET_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  MAX_PAYMENT_USD: z.string().default("$0.10"),
  TRUSTED_PAY_TO: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/)
    .optional(),
});

const env = envSchema.parse(process.env);
const account = privateKeyToAccount(env.AGENT_PRIVATE_KEY as `0x${string}`);

const fetchWithPayment = wrapFetchWithPaymentFromConfig(fetch, {
  schemes: [{ network: "eip155:*", client: new ExactEvmScheme(account) }],
  spendControls: {
    maxAmountPerPayment: env.MAX_PAYMENT_USD,
  },
  policies: env.TRUSTED_PAY_TO
    ? [
        (_version, requirements) =>
          requirements.filter(
            (requirement) =>
              requirement.payTo.toLowerCase() ===
              env.TRUSTED_PAY_TO?.toLowerCase(),
          ),
      ]
    : undefined,
});

const url = new URL(env.API_URL);
url.searchParams.set("wallet", env.WALLET_ADDRESS);

const response = await fetchWithPayment(url);
const body = await response.text();

if (!response.ok) {
  throw new Error(`API returned ${response.status}: ${body}`);
}

console.log(body);
