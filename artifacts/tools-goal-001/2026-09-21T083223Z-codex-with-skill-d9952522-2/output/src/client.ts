import { wrapFetchWithPaymentFromConfig, decodePaymentResponseHeader } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm";
import { privateKeyToAccount } from "viem/accounts";
import { readClientEnv } from "./config.js";

const env = readClientEnv();
const walletAddress = process.argv[2];

if (!walletAddress) {
  console.error("Usage: npm run client -- 0xWalletToSummarize");
  process.exit(1);
}

const account = privateKeyToAccount(env.CLIENT_PRIVATE_KEY as `0x${string}`);
const fetchWithPayment = wrapFetchWithPaymentFromConfig(fetch, {
  schemes: [
    {
      network: env.PAYMENT_NETWORK,
      client: new ExactEvmScheme(account),
    },
  ],
});

const url = new URL(`/api/wallet/${walletAddress}/summary`, env.API_BASE_URL);
const response = await fetchWithPayment(url, {
  headers: {
    accept: "application/json",
  },
});

const body = await response.json();

if (!response.ok) {
  console.error(JSON.stringify(body, null, 2));
  process.exit(1);
}

const paymentResponse = response.headers.get("payment-response");

console.log(JSON.stringify(body, null, 2));

if (paymentResponse) {
  console.log("\nPayment receipt:");
  console.log(JSON.stringify(decodePaymentResponseHeader(paymentResponse), null, 2));
}
