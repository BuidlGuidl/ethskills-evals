/**
 * x402 client: calls the paid endpoint, signs the payment when the server answers
 * 402, and retries the request automatically.
 *
 * Usage: npm run client -- 0xWalletToSummarize [http://localhost:4021]
 */
import "dotenv/config";
import { createPublicClient, http, isAddress } from "viem";
import { base, baseSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { ExactEvmScheme, toClientEvmSigner } from "@x402/evm";
import { decodePaymentRequiredHeader } from "@x402/core/http";
import { decodePaymentResponseHeader, wrapFetchWithPayment, x402Client } from "@x402/fetch";
import { requireEnv, resolveNetwork } from "../config.js";

const network = resolveNetwork();
const chain = network.chainId === base.id ? base : baseSepolia;

const target = process.argv[2];
const baseUrl = process.argv[3] ?? process.env.API_URL ?? "http://localhost:4021";

if (!target || !isAddress(target)) {
  console.error("Usage: npm run client -- <0xWalletAddress> [apiBaseUrl]");
  process.exit(1);
}

const account = privateKeyToAccount(requireEnv("CLIENT_PRIVATE_KEY") as `0x${string}`);
const publicClient = createPublicClient({ chain, transport: http(process.env.RPC_URL) });

// The scoped @x402/fetch wrapper takes an x402Client with schemes registered per
// network — not a bare wallet.
const client = new x402Client().register(
  network.caip2,
  new ExactEvmScheme(toClientEvmSigner(account, publicClient)),
);

const fetchWithPayment = wrapFetchWithPayment(fetch, client);

console.log(`Paying from ${account.address} on ${network.name}`);

const res = await fetchWithPayment(`${baseUrl}/activity/${target}`, {
  headers: { accept: "application/json" },
});

if (!res.ok) {
  console.error(`Request failed: ${res.status} ${res.statusText}`);
  // On a rejected payment the reason travels in the PAYMENT-REQUIRED header, not the body.
  const required = res.headers.get("payment-required");
  if (required) {
    const decoded = decodePaymentRequiredHeader(required);
    console.error("Payment rejected:", decoded.error ?? "no reason given");
  }
  console.error(await res.text());
  process.exit(1);
}

const paymentHeader = res.headers.get("x-payment-response");
if (paymentHeader) {
  const settlement = decodePaymentResponseHeader(paymentHeader);
  console.log("Payment settled:", {
    success: settlement.success,
    network: settlement.network,
    transaction: settlement.transaction,
    payer: settlement.payer,
  });
} else {
  console.log("No settlement header — the response was served without payment.");
}

console.log(JSON.stringify(await res.json(), null, 2));
