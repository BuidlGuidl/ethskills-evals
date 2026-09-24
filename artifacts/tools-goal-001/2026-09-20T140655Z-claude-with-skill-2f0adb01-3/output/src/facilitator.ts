import { createFacilitatorConfig } from "@coinbase/x402";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { networkKey } from "./config.js";

/**
 * The facilitator is the third party that verifies the signed payment and
 * broadcasts the USDC transfer on-chain. We never hold the agent's funds and we
 * never need its private key.
 *
 * - base-sepolia: the free public x402 facilitator, no credentials.
 * - base (mainnet): Coinbase CDP, which requires CDP API keys.
 */
export function createFacilitatorClient(): HTTPFacilitatorClient {
  if (networkKey === "base-sepolia") {
    return new HTTPFacilitatorClient({ url: "https://x402.org/facilitator" });
  }

  const id = process.env.CDP_API_KEY_ID;
  const secret = process.env.CDP_API_KEY_SECRET;
  if (!id || !secret) {
    throw new Error(
      "Base mainnet settlement needs CDP_API_KEY_ID and CDP_API_KEY_SECRET " +
        "(https://portal.cdp.coinbase.com). Use X402_NETWORK=base-sepolia to run without them.",
    );
  }
  return new HTTPFacilitatorClient(createFacilitatorConfig(id, secret));
}
