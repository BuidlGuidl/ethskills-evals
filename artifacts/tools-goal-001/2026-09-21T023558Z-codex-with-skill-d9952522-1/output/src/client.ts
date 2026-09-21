import "dotenv/config";

import { wrapFetchWithPaymentFromConfig, decodePaymentResponseHeader } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { getAddress, isAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { getPaymentNetwork, optionalEnv, requireEnv } from "./config.js";

const [, , rawAddress] = process.argv;
const wallet = rawAddress ?? "0x0000000000000000000000000000000000000000";

if (!isAddress(wallet)) {
  throw new Error("Usage: npm run client -- <wallet-address>");
}

const apiBaseUrl = optionalEnv("API_BASE_URL") ?? "http://localhost:3000";
const privateKey = requireEnv("CLIENT_PRIVATE_KEY") as `0x${string}`;
const network = getPaymentNetwork();
const account = privateKeyToAccount(privateKey);

const fetchWithPayment = wrapFetchWithPaymentFromConfig(fetch, {
  schemes: [
    {
      network,
      client: new ExactEvmScheme(account),
    },
  ],
  spendControls: {
    maxAmountPerPayment: optionalEnv("MAX_AMOUNT_PER_PAYMENT") ?? "$0.10",
  },
});

const url = `${apiBaseUrl.replace(/\/+$/, "")}/v1/wallets/${getAddress(wallet)}/activity-summary`;
const response = await fetchWithPayment(url, {
  headers: { accept: "application/json" },
});

const paymentResponse = response.headers.get("PAYMENT-RESPONSE");
const body = await response.json();

if (!response.ok) {
  console.error(JSON.stringify(body, null, 2));
  throw new Error(`Request failed with HTTP ${response.status}`);
}

console.log(JSON.stringify(body, null, 2));

if (paymentResponse) {
  console.error("Payment settlement:");
  console.error(JSON.stringify(decodePaymentResponseHeader(paymentResponse), null, 2));
}
