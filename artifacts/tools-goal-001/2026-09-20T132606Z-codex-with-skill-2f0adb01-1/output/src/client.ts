import "dotenv/config";

import { x402Client, x402HTTPClient, wrapFetchWithPayment } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";
import { z } from "zod";

const envSchema = z.object({
  EVM_PRIVATE_KEY: z.string().regex(/^0x[a-fA-F0-9]{64}$/, "EVM_PRIVATE_KEY must be a 32-byte hex private key"),
  API_BASE_URL: z.string().url().default("http://localhost:4021"),
  WALLET_TO_SUMMARIZE: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "WALLET_TO_SUMMARIZE must be an EVM address"),
  BASE_RPC_URL: z.string().url().default("https://mainnet.base.org"),
});

const env = envSchema.parse(process.env);
const signer = privateKeyToAccount(env.EVM_PRIVATE_KEY as `0x${string}`);

const client = new x402Client().register(
  "eip155:*",
  new ExactEvmScheme(signer, {
    8453: { rpcUrl: env.BASE_RPC_URL },
    84532: { rpcUrl: env.BASE_RPC_URL },
  }),
);

const fetchWithPayment = wrapFetchWithPayment(fetch, client);
const httpClient = new x402HTTPClient(client);

const url = new URL("/v1/wallet/summary", env.API_BASE_URL);
url.searchParams.set("address", env.WALLET_TO_SUMMARIZE);

const response = await fetchWithPayment(url, { method: "GET" });
const result = await httpClient.processResponse(response);

if (result.status >= 400) {
  console.error(JSON.stringify(result.body, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify(result.body, null, 2));
}

if (result.paymentStatus === "settled") {
  console.error("Payment settled:", JSON.stringify(result.header, null, 2));
} else if (result.paymentStatus !== "none") {
  console.error("Payment status:", result.paymentStatus, JSON.stringify(result.header, null, 2));
}
