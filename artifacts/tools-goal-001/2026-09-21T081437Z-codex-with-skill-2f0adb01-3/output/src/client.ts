import { decodePaymentResponseHeader, wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";
import { clientConfig, normalizeAddress } from "./config.js";

const walletFromArg = process.argv[2] ?? process.env.WALLET_ADDRESS;

if (!walletFromArg) {
  throw new Error("Pass a wallet address as argv[2] or set WALLET_ADDRESS");
}

const wallet = normalizeAddress(walletFromArg, "WALLET_ADDRESS");
const account = privateKeyToAccount(clientConfig.privateKey());

const fetchWithPayment = wrapFetchWithPaymentFromConfig(fetch, {
  schemes: [
    {
      network: clientConfig.network,
      client: new ExactEvmScheme(account),
    },
  ],
  spendControls: {
    maxAmountPerPayment: clientConfig.maxPayment,
  },
});

const endpoint = new URL(`/v1/wallets/${wallet}/activity-summary`, clientConfig.apiBaseUrl);
const response = await fetchWithPayment(endpoint, {
  method: "GET",
  headers: {
    accept: "application/json",
  },
});

const body = await response.text();
const paymentResponse = response.headers.get("PAYMENT-RESPONSE");

if (!response.ok) {
  throw new Error(`API returned ${response.status}: ${body}`);
}

console.log(JSON.stringify(JSON.parse(body), null, 2));

if (paymentResponse) {
  console.error("\nPayment settlement:");
  console.error(JSON.stringify(decodePaymentResponseHeader(paymentResponse), null, 2));
}
