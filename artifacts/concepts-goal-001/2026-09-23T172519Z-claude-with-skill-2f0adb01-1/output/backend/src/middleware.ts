import type { Address } from "viem";
import { SubscriptionGate } from "./subscriptionGate.js";
import { addressFromApiKey, hashApiKey } from "./auth.js";

/**
 * Express-style gate for the weather API. Two checks, in order:
 *   1. Who is this? (API key -> address, authenticated)
 *   2. Are they paid up? (contract -> activeUntil, cached)
 */
export interface KeyStore {
  /** Returns the stored HMAC for a key's address, or null if unknown/revoked. */
  lookup(address: Address): Promise<string | null>;
}

export function subscriptionMiddleware(gate: SubscriptionGate, keys: KeyStore, serverSecret: string) {
  return async function gateRequest(req: any, res: any, next: any) {
    const header: string | undefined = req.headers?.authorization;
    const apiKey = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
    if (!apiKey) {
      return res.status(401).json({ error: "missing_api_key" });
    }

    const address = addressFromApiKey(apiKey);
    if (!address) {
      return res.status(401).json({ error: "malformed_api_key" });
    }

    const stored = await keys.lookup(address);
    if (!stored || stored !== hashApiKey(apiKey, serverSecret)) {
      return res.status(401).json({ error: "invalid_api_key" });
    }

    let active: boolean;
    try {
      active = await gate.isActive(address);
    } catch {
      // Gate policy said fail-closed and we had nothing cached. This is an
      // outage on our side, not the customer's fault — say so honestly with a
      // 503 and a Retry-After rather than a 402 that blames them.
      res.setHeader("Retry-After", "5");
      return res.status(503).json({ error: "billing_unavailable" });
    }

    if (!active) {
      return res.status(402).json({
        error: "subscription_inactive",
        message: "Top up your balance or start a subscription to continue.",
        contract: gate["contract"],
      });
    }

    req.subscriberAddress = address;
    return next();
  };
}
