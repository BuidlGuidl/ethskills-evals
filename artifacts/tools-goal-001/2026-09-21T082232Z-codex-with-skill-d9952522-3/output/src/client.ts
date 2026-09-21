import { decodePaymentResponseHeader, wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import type { Network } from "@x402/core/types";
import { privateKeyToAccount } from "viem/accounts";
import { getClientEnv } from "./config.js";

const env = getClientEnv();
const network = env.NETWORK as Network;
const walletAddress = process.argv[2];
const limit = process.argv[3] ?? "8";

if (!walletAddress) {
  console.error("Usage: npm run client -- <walletAddress> [limit]");
  process.exit(1);
}

const account = privateKeyToAccount(env.EVM_PRIVATE_KEY as `0x${string}`);
const schemeOptions = env.RPC_URL ? { rpcUrl: env.RPC_URL } : undefined;

const fetchWithPayment = wrapFetchWithPaymentFromConfig(fetch, {
  schemes: [
    {
      network,
      client: new ExactEvmScheme(account, schemeOptions),
    },
  ],
});

const url = new URL(`/v1/wallet/${walletAddress}/summary`, env.API_URL);
url.searchParams.set("limit", limit);

const response = await fetchWithPayment(url, {
  headers: { accept: "application/json" },
});

const body = await response.json();
const paymentResponse = response.headers.get("payment-response");

console.log(JSON.stringify(body, null, 2));

if (paymentResponse) {
  const settlement = decodePaymentResponseHeader(paymentResponse);
  console.error(
    `Settled ${settlement.amount ?? "unknown amount"} on ${settlement.network}: ${settlement.transaction}`,
  );
}

if (!response.ok) {
  process.exitCode = 1;
}
