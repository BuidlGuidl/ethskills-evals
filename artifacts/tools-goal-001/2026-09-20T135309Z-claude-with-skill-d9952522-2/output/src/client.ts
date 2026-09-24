import { createPublicClient, http } from "viem";
import { base, baseSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import {
  decodePaymentResponseHeader,
  wrapFetchWithPayment,
  x402Client,
} from "@x402/fetch";
import { ExactEvmScheme, toClientEvmSigner } from "@x402/evm";
import { CHAIN, EXPLORER_TX, NETWORK, SERVER_URL } from "./config.js";

/**
 * Agent-side client. wrapFetchWithPayment does the whole 402 dance: it makes the
 * call, and on a 402 it signs the payment the server asked for and retries the
 * same request with the X-PAYMENT header attached.
 */
export function createPayingFetch(privateKey: `0x${string}`) {
  const account = privateKeyToAccount(privateKey);
  const publicClient = createPublicClient({
    chain: CHAIN === "base" ? base : baseSepolia,
    transport: http(process.env.RPC_URL),
  });

  // The scoped @x402/* packages take an x402 client, not a raw wallet/account.
  const client = new x402Client().register(
    NETWORK,
    new ExactEvmScheme(toClientEvmSigner(account, publicClient)),
  );

  return { account, fetchWithPay: wrapFetchWithPayment(fetch, client) };
}

/** Calls the paid endpoint and returns the summary plus the settlement receipt. */
export async function getPaidWalletActivity(
  fetchWithPay: ReturnType<typeof createPayingFetch>["fetchWithPay"],
  address: string,
) {
  const response = await fetchWithPay(`${SERVER_URL}/activity/${address}`);
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}: ${await response.text()}`);
  }

  const header = response.headers.get("x-payment-response");
  const settlement = header ? decodePaymentResponseHeader(header) : null;

  return { activity: await response.json(), settlement };
}

async function main() {
  const privateKey = process.env.AGENT_PRIVATE_KEY as `0x${string}` | undefined;
  if (!privateKey) {
    throw new Error("AGENT_PRIVATE_KEY is required: the funded wallet the agent pays from.");
  }

  const address = process.argv[2];
  if (!address) {
    throw new Error("usage: npm run client -- <wallet-address>");
  }

  const { account, fetchWithPay } = createPayingFetch(privateKey);
  console.log(`paying from ${account.address} on ${CHAIN}`);

  const { activity, settlement } = await getPaidWalletActivity(fetchWithPay, address);
  console.log(`\n${activity.summary}\n`);
  console.log(JSON.stringify(activity.recentTransactions, null, 2));

  if (settlement?.transaction) {
    console.log(`\nsettled onchain: ${EXPLORER_TX}${settlement.transaction}`);
  }
}

// Only run the demo when executed directly, so the helpers stay importable.
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
