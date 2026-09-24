/**
 * Agent-side client. wrapFetchWithPayment intercepts the 402, signs a payment
 * authorization with the agent's key, and retries the request with the
 * X-PAYMENT header — so callers just await fetch and get the data.
 *
 *   npm run client -- 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045
 */
import "dotenv/config";
import { privateKeyToAccount } from "viem/accounts";
import { wrapFetchWithPayment, x402Client, decodePaymentResponseHeader } from "@x402/fetch";
import { decodePaymentRequiredHeader } from "@x402/core/http";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import type { Network } from "@x402/core/types";
import type { ActivitySummary } from "./activity.js";

const BASE_URL = process.env.RESOURCE_URL ?? "http://localhost:4021";
const NETWORK = (process.env.NETWORK ?? "eip155:84532") as Network;

/**
 * Builds a fetch that pays for 402-gated resources automatically.
 *
 * @param privateKey - The agent wallet key used to sign payment authorizations
 * @returns A fetch-compatible function that settles payments inline
 */
export function createPayingFetch(privateKey: `0x${string}`) {
  const account = privateKeyToAccount(privateKey);
  const client = registerExactEvmScheme(new x402Client(), {
    signer: account,
    networks: [NETWORK],
  });
  // Hard per-call ceiling, so a hostile or misconfigured 402 can't drain the
  // wallet. Defaults to $1 and default assets only; this tightens it.
  client.setSpendControls({ maxAmountPerPayment: "$0.10" });
  return { account, fetchWithPay: wrapFetchWithPayment(fetch, client) };
}

/**
 * Fetches a paid wallet-activity summary.
 *
 * @param address - Wallet to summarize
 * @returns The summary plus the settlement receipt, when the server returned one
 */
export async function getWalletActivity(
  address: string,
): Promise<{ data: ActivitySummary; receipt: unknown }> {
  const privateKey = process.env.PRIVATE_KEY as `0x${string}` | undefined;
  if (!privateKey || privateKey === "0x") {
    throw new Error("PRIVATE_KEY is required — it is the wallet that pays per call.");
  }

  const { fetchWithPay } = createPayingFetch(privateKey);
  const res = await fetchWithPay(`${BASE_URL}/activity/${address}`);
  if (!res.ok) {
    // A second 402 means the payment was built but rejected — usually an
    // unfunded wallet. The header carries the facilitator's reason.
    const required = res.headers.get("payment-required");
    const reason = required ? decodePaymentRequiredHeader(required).error : await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${reason ?? "(no reason given)"}`);
  }

  const header = res.headers.get("x-payment-response");
  return {
    data: (await res.json()) as ActivitySummary,
    receipt: header ? decodePaymentResponseHeader(header) : null,
  };
}

const target = process.argv[2];
if (target) {
  const { data, receipt } = await getWalletActivity(target);
  console.log(data.summary);
  console.log("\nfull payload:", JSON.stringify(data, null, 2));
  console.log("\nsettlement:", JSON.stringify(receipt, null, 2));
}
