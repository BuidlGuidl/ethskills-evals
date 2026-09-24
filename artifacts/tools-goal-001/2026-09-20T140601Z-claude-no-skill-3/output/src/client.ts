/**
 * Agent-side client. wrapFetchWithPayment turns a normal fetch into one that
 * handles 402 by itself: request -> 402 with a price quote -> sign a USDC
 * transfer authorization -> retry with the X-PAYMENT header -> 200.
 *
 * The caller just awaits a response. The payment is one signature, not a
 * transaction the agent has to broadcast or pay gas for.
 */
import { wrapFetchWithPayment, createSigner, decodeXPaymentResponse } from "x402-fetch";
import { NETWORK, clientConfig } from "./config.js";

/** Refuse to pay more than this for a single call, in USDC base units (6dp). */
const MAX_PAYMENT = 50_000n; // $0.05

export type PaidResponse<T> = {
  data: T;
  /** Present once the call actually settled on-chain. */
  payment: { transaction: string; network: string; payer: string } | null;
};

export async function createPaidClient(opts?: { privateKey?: string; baseUrl?: string }) {
  const cfg = clientConfig();
  const privateKey = opts?.privateKey ?? cfg.privateKey;
  const baseUrl = (opts?.baseUrl ?? cfg.baseUrl).replace(/\/$/, "");

  const signer = await createSigner(NETWORK, privateKey);
  const fetchWithPayment = wrapFetchWithPayment(fetch, signer, MAX_PAYMENT);

  return {
    async get<T>(path: string): Promise<PaidResponse<T>> {
      const res = await fetchWithPayment(`${baseUrl}${path}`, { method: "GET" });
      if (!res.ok) {
        throw new Error(`${res.status} ${res.statusText}: ${await res.text()}`);
      }

      const header = res.headers.get("x-payment-response");
      const receipt = header ? decodeXPaymentResponse(header) : null;

      return {
        data: (await res.json()) as T,
        payment: receipt
          ? { transaction: receipt.transaction, network: receipt.network, payer: receipt.payer }
          : null,
      };
    },

    getWalletActivity<T = unknown>(address: string) {
      return this.get<T>(`/v1/wallet/${address}`);
    },
  };
}

// Run directly: `npm run client -- 0xabc...`
if (import.meta.url === `file://${process.argv[1]}`) {
  const address = process.argv[2] ?? "0x4200000000000000000000000000000000000006";
  const client = await createPaidClient();

  console.log(`Requesting activity for ${address} (paying if asked)...`);
  const { data, payment } = await client.getWalletActivity<{ summary: string }>(address);

  console.log(`\n${data.summary}\n`);
  console.log(
    payment
      ? `Paid. settlement tx ${payment.transaction} on ${payment.network} from ${payment.payer}`
      : "No payment was required for this response.",
  );
  console.log("\nFull payload:");
  console.log(JSON.stringify(data, null, 2));
}
