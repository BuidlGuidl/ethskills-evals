import { decodePaymentResponseHeader, wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";
import { getAddress, isAddress } from "viem";
import { env, requireNetwork, requirePrivateKey } from "./config.js";

const [walletArg, limitArg] = process.argv.slice(2);

if (!walletArg || !isAddress(walletArg)) {
  console.error("Usage: npm run client -- 0xWalletAddress [limit]");
  process.exit(1);
}

const account = privateKeyToAccount(requirePrivateKey("AGENT_PRIVATE_KEY", env.AGENT_PRIVATE_KEY));
const paymentNetwork = requireNetwork("PAYMENT_NETWORK", env.PAYMENT_NETWORK);
const fetchWithPayment = wrapFetchWithPaymentFromConfig(fetch, {
  schemes: [
    {
      network: paymentNetwork,
      client: new ExactEvmScheme(account)
    }
  ],
  spendControls: {
    maxAmountPerPayment: env.MAX_PAYMENT_PER_CALL
  }
});

const url = new URL(`/v1/wallet/${getAddress(walletArg)}/summary`, env.API_BASE_URL);
if (limitArg) {
  url.searchParams.set("limit", limitArg);
}

const response = await fetchWithPayment(url, {
  headers: { accept: "application/json" }
});

const body = await response.json();
const paymentResponse = response.headers.get("PAYMENT-RESPONSE");

if (!response.ok) {
  console.error(JSON.stringify(body, null, 2));
  process.exit(1);
}

console.log(JSON.stringify(body, null, 2));

if (paymentResponse) {
  console.error("Payment settlement:");
  console.error(JSON.stringify(decodePaymentResponseHeader(paymentResponse), null, 2));
}
