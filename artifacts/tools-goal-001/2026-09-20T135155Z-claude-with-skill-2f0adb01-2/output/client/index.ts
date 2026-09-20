/**
 * Example agent-side client: pays for the endpoint inline and retries.
 *
 * `wrapFetchWithPayment` does the whole 402 dance — it issues the request,
 * reads the payment requirements off the 402, signs an EIP-3009/Permit2
 * authorization with the local key, and replays the request with an
 * `X-PAYMENT` header. No accounts, no API keys.
 */
import { wrapFetchWithPayment, x402Client, decodePaymentResponseHeader } from "@x402/fetch";
import { decodePaymentRequiredHeader } from "@x402/core/http";
import { ExactEvmScheme } from "@x402/evm";
import type { Network } from "@x402/core/types";
import { privateKeyToAccount } from "viem/accounts";

const NETWORKS: Record<string, Network> = {
  "base-sepolia": "eip155:84532",
  base: "eip155:8453",
};

function main() {
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey?.startsWith("0x")) {
    throw new Error("Set PRIVATE_KEY to a 0x-prefixed key holding USDC on the target chain");
  }

  const chain = process.env.CHAIN ?? "base-sepolia";
  const network = NETWORKS[chain];
  if (!network) throw new Error(`CHAIN must be one of: ${Object.keys(NETWORKS).join(", ")}`);

  const baseUrl = process.env.API_URL ?? "http://localhost:4021";
  const wallet = process.argv[2] ?? "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";

  const account = privateKeyToAccount(privateKey as `0x${string}`);

  const client = new x402Client()
    .register(network, new ExactEvmScheme(account))
    // Hard ceiling per call, so a misbehaving server can't drain the agent.
    .setSpendControls({ maxAmountPerPayment: process.env.MAX_PER_CALL ?? "$0.10" });

  return { account, client, baseUrl, wallet, chain };
}

const { account, client, baseUrl, wallet, chain } = main();
const fetchWithPayment = wrapFetchWithPayment(fetch, client);

console.log(`Paying from ${account.address} on ${chain}`);

const response = await fetchWithPayment(`${baseUrl}/activity/${wallet}`);

if (!response.ok) {
  console.error(`Request failed: ${response.status} ${response.statusText}`);
  // A 402 on the *retry* means the facilitator refused the payment — the
  // reason (insufficient USDC, expired authorization, ...) rides along in
  // the payment-required header, not the body.
  const challenge = response.headers.get("payment-required");
  if (challenge) {
    console.error(`Payment rejected: ${decodePaymentRequiredHeader(challenge).error ?? "unknown reason"}`);
  }
  console.error(await response.text());
  process.exit(1);
}

// Present once the payment settled; carries the on-chain settlement tx hash.
const receiptHeader = response.headers.get("x-payment-response");
const receipt = receiptHeader ? decodePaymentResponseHeader(receiptHeader) : null;

const body = (await response.json()) as { summary: string };
console.log("\n--- summary ---");
console.log(body.summary);

if (receipt) {
  console.log("\n--- settlement ---");
  console.log(JSON.stringify(receipt, null, 2));
}
