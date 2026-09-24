import { x402Client, wrapFetchWithPayment, decodePaymentResponseHeader } from "@x402/fetch";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";
import { chain, PORT, RPC_URL } from "./config.js";
import type { WalletSummary } from "./summary.js";

export type PaidFetchOptions = {
  /** Private key of the agent's wallet. It signs payments; it is never sent anywhere. */
  privateKey: `0x${string}`;
  /** Hard per-call ceiling, as a dollar string. Anything pricier is refused locally. */
  maxPerCall?: string;
};

/**
 * Returns a drop-in `fetch` that pays for 402 responses and retries automatically:
 * request → 402 with requirements → sign an EIP-3009 USDC authorization → retry
 * with the `X-PAYMENT` header. The signature is an off-chain authorization; the
 * server's facilitator broadcasts it, so the agent never pays gas.
 */
export function createPaidFetch(options: PaidFetchOptions) {
  const account = privateKeyToAccount(options.privateKey);

  const client = new x402Client();
  registerExactEvmScheme(client, {
    signer: account,
    networks: [chain.network],
    schemeOptions: { rpcUrl: RPC_URL },
  });
  // Belt and braces on top of the SDK defaults: refuse anything above our cap,
  // and only ever spend the network's default asset (USDC).
  client.setSpendControls({ maxAmountPerPayment: options.maxPerCall ?? "$0.05" });

  return {
    fetch: wrapFetchWithPayment(globalThis.fetch, client),
    payerAddress: account.address,
  };
}

async function main() {
  const privateKey = process.env.AGENT_PRIVATE_KEY as `0x${string}` | undefined;
  if (!privateKey?.startsWith("0x")) {
    throw new Error("Set AGENT_PRIVATE_KEY to the paying wallet's private key");
  }

  const baseUrl = process.env.API_URL ?? `http://localhost:${PORT}`;
  const wallet = process.argv[2] ?? "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";

  const { fetch: paidFetch, payerAddress } = createPaidFetch({ privateKey });
  console.log(`paying from ${payerAddress} on ${chain.network}`);

  const res = await paidFetch(`${baseUrl}/v1/wallet/${wallet}/summary`);
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}: ${await res.text()}`);
  }

  // Present only after a paid call; contains the settlement transaction hash.
  // v2 sends PAYMENT-RESPONSE; X-PAYMENT-RESPONSE is the v1 spelling.
  const receiptHeader =
    res.headers.get("payment-response") ?? res.headers.get("x-payment-response");
  const body = (await res.json()) as WalletSummary;

  console.log(`\n${body.summary}\n`);
  if (receiptHeader) {
    const receipt = decodePaymentResponseHeader(receiptHeader);
    console.log("settled:", `${chain.explorer}/tx/${receipt.transaction}`);
  }
}

// Only run the demo when this file is executed directly, not when imported.
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
