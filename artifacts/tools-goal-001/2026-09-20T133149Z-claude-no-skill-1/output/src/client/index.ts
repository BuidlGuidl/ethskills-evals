import "dotenv/config";
import { wrapFetchWithPayment, decodeXPaymentResponse, createSigner } from "x402-fetch";
import { parseUnits } from "viem";
import { resolveNetwork } from "../config.js";
import type { ActivitySummary } from "../server/activity.js";

export interface PaidClientOptions {
  /** Base URL of the paid API, e.g. http://localhost:4021 */
  baseUrl: string;
  /** Private key of the agent's spending wallet. Must hold USDC on the target network. */
  privateKey: `0x${string}`;
  network?: "base" | "base-sepolia";
  /** Hard cap per call, in USDC. The client refuses to pay more than this. */
  maxPriceUsdc?: number;
  /** Retries for transient transport/server failures (payment itself is never retried blindly). */
  maxRetries?: number;
}

export interface PaidResult<T> {
  data: T;
  /** Populated once a payment was actually settled on-chain. */
  payment?: { transaction: string; network: string; payer: string; success: boolean };
}

export class PaidRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "PaidRequestError";
  }
}

const USDC_DECIMALS = 6;

/** Turns the facilitator's error codes into something an operator can act on. */
function explainFailure(status: number, body: string): string {
  let code: string | undefined;
  try {
    code = (JSON.parse(body) as { error?: string }).error;
  } catch {
    /* body was not JSON */
  }

  if (code?.includes("insufficient_balance")) {
    return "payment rejected: the spending wallet does not hold enough USDC on this network.";
  }
  if (status === 402) {
    return `payment rejected by the facilitator (${code ?? "unknown reason"}).`;
  }
  return `${status}: ${body.slice(0, 300)}`;
}

/**
 * Creates a client for the wallet-activity API that settles payment inline.
 *
 * `wrapFetchWithPayment` does the protocol work: it issues the request, and if the
 * server answers 402 Payment Required it signs an EIP-3009 USDC authorization for the
 * advertised amount and replays the same request with an X-PAYMENT header.
 */
export async function createPaidClient(options: PaidClientOptions) {
  const network = options.network ?? resolveNetwork();
  const maxValue = parseUnits(String(options.maxPriceUsdc ?? 0.1), USDC_DECIMALS);
  const maxRetries = options.maxRetries ?? 2;

  const signer = await createSigner(network, options.privateKey);
  const fetchWithPayment = wrapFetchWithPayment(fetch, signer, maxValue);

  async function request<T>(path: string, init?: RequestInit): Promise<PaidResult<T>> {
    const url = new URL(path, options.baseUrl).toString();
    let lastError: unknown;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const res = await fetchWithPayment(url, init);

        // 4xx is the caller's fault (bad input or bad payment) and never settles,
        // so retrying it would just fail again - surface it immediately.
        if (res.status >= 400 && res.status < 500) {
          throw new PaidRequestError(explainFailure(res.status, await res.text()), res.status);
        }
        if (!res.ok) {
          lastError = new Error(`${res.status} ${res.statusText}: ${await res.text()}`);
        } else {
          const header = res.headers.get("x-payment-response");
          return {
            data: (await res.json()) as T,
            payment: header ? decodeXPaymentResponse(header) : undefined,
          };
        }
      } catch (error) {
        if (error instanceof PaidRequestError) throw error;
        lastError = error;
      }

      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
      }
    }
    throw lastError ?? new Error("Request failed");
  }

  return {
    request,
    /** Buys one wallet-activity summary. */
    getActivity(address: string, params: { limit?: number; windowDays?: number } = {}) {
      const query = new URLSearchParams({ address });
      if (params.limit !== undefined) query.set("limit", String(params.limit));
      if (params.windowDays !== undefined) query.set("windowDays", String(params.windowDays));
      return request<ActivitySummary>(`/activity?${query}`);
    },
  };
}

// --- CLI: npm run client -- 0xWalletToInspect ---
if (import.meta.url === `file://${process.argv[1]}`) {
  const target = process.argv[2];
  const privateKey = process.env.PRIVATE_KEY as `0x${string}` | undefined;

  if (!target) {
    console.error("usage: npm run client -- <address-to-summarize>");
    process.exit(1);
  }
  if (!privateKey) {
    console.error("Set PRIVATE_KEY in .env - it funds the payment. See .env.example.");
    process.exit(1);
  }

  const client = await createPaidClient({
    baseUrl: process.env.API_URL ?? "http://localhost:4021",
    privateKey,
    maxPriceUsdc: Number(process.env.MAX_PRICE_USDC ?? 0.1),
  });

  const { data, payment } = await client.getActivity(target).catch((error: unknown) => {
    console.error(`\nRequest failed - ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  });
  console.log("\n" + data.summary + "\n");
  console.log(JSON.stringify(data, null, 2));
  if (payment) {
    console.log(`\nPaid by ${payment.payer} - settlement tx ${payment.transaction}`);
  } else {
    console.log("\nNo payment was required for this response.");
  }
}
