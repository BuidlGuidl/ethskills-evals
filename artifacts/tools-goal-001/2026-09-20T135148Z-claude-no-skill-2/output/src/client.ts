import { createSigner, decodeXPaymentResponse, wrapFetchWithPayment } from "x402-fetch";
import { NETWORK, clientConfig } from "./config.js";
import type { WalletSummary } from "./activity.js";

/** Max we'll auto-pay per call, in USDC base units (6 decimals). 0.10 USDC. */
const MAX_PAYMENT = BigInt(process.env.MAX_PAYMENT_BASE_UNITS ?? 100_000);

/**
 * Returns a `fetch` that transparently handles 402s: on a payment challenge it
 * signs an EIP-3009 USDC authorization with the agent's key and replays the
 * request with an X-PAYMENT header. Callers just await a normal Response.
 */
export async function createPayingFetch() {
  const signer = await createSigner(NETWORK, clientConfig.privateKey());
  return wrapFetchWithPayment(fetch, signer, MAX_PAYMENT);
}

export async function fetchWalletSummary(address: string, apiUrl = clientConfig.apiUrl) {
  const payingFetch = await createPayingFetch();
  const res = await payingFetch(`${apiUrl}/wallet/${address}/summary`);

  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}: ${await res.text()}`);
  }

  const paymentHeader = res.headers.get("x-payment-response");
  return {
    data: (await res.json()) as WalletSummary,
    // Present when the facilitator settled on-chain; `transaction` is the tx hash.
    payment: paymentHeader ? decodeXPaymentResponse(paymentHeader) : null,
  };
}

// CLI: npm run client -- 0xWalletToInspect
if (import.meta.url === `file://${process.argv[1]}`) {
  const address = process.argv[2];
  if (!address) {
    console.error("usage: npm run client -- <wallet-address>");
    process.exit(1);
  }

  const { data, payment } = await fetchWalletSummary(address);
  console.log("\n--- summary ---------------------------------------------");
  console.log(data.summary);
  console.log("\n--- full payload ----------------------------------------");
  console.log(JSON.stringify(data, null, 2));
  console.log("\n--- payment ---------------------------------------------");
  console.log(payment ? JSON.stringify(payment, null, 2) : "no settlement receipt returned");
}
