import { privateKeyToAccount } from "viem/accounts";
import { ExactEvmScheme } from "@x402/evm";
import { decodePaymentResponseHeader, wrapFetchWithPayment, x402Client } from "@x402/fetch";
import { chain, clientConfig } from "./config.js";
import type { ActivitySummary } from "./activity.js";

/**
 * Builds a fetch that transparently handles HTTP 402: it signs a USDC payment
 * authorization for the amount the server asked for, then replays the request
 * with an X-PAYMENT header. One call site, no accounts, no API keys.
 */
export function createPayingFetch(privateKey: `0x${string}`) {
  const account = privateKeyToAccount(privateKey);
  const client = new x402Client().register(chain().network, new ExactEvmScheme(account));
  return { fetch: wrapFetchWithPayment(globalThis.fetch, client), address: account.address };
}

export type PaidSummary = {
  data: ActivitySummary;
  /** Settlement receipt from the server, when it reports one. */
  txHash?: string;
};

export async function getWalletSummary(
  wallet: string,
  opts: { privateKey?: `0x${string}`; baseUrl?: string } = {},
): Promise<PaidSummary> {
  const { fetch: payingFetch } = createPayingFetch(opts.privateKey ?? clientConfig.privateKey());
  const baseUrl = opts.baseUrl ?? clientConfig.baseUrl;

  const res = await payingFetch(`${baseUrl}/summary/${wallet}`);
  if (!res.ok) {
    throw new Error(`Request failed: ${res.status} ${await res.text()}`);
  }

  // v2 sends "payment-response"; "x-payment-response" is the v1 spelling.
  const header =
    res.headers.get("payment-response") ?? res.headers.get("x-payment-response");
  const settlement = header ? decodePaymentResponseHeader(header) : undefined;

  return {
    data: (await res.json()) as ActivitySummary,
    txHash: settlement?.transaction,
  };
}

// Demo: `npm run client -- 0xWalletToInspect`
if (import.meta.url === `file://${process.argv[1]}`) {
  const wallet = process.argv[2] ?? "0x4200000000000000000000000000000000000006";
  const { address } = createPayingFetch(clientConfig.privateKey());

  console.log(`paying from ${address} on ${chain().network}`);
  const { data, txHash } = await getWalletSummary(wallet);
  console.log("\n" + data.summary + "\n");
  console.log(JSON.stringify(data, null, 2));
  if (txHash) {
    console.log(`\nsettled on-chain: ${chain().blockscout}/tx/${txHash}`);
  }
}
