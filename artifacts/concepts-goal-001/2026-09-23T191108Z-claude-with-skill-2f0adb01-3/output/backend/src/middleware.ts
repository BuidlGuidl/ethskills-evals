import type { Address } from "viem";
import { SubscriptionGate } from "./billing.js";

/**
 * Express-style middleware showing how the gate slots into the request path.
 *
 * Authentication is a separate problem from billing: the contract knows what an *address* has
 * paid for, but an HTTP request has to prove it belongs to that address. Two workable options:
 *
 *   1. API keys (simplest). Customer signs a one-off "link this key to my address" message with
 *      their wallet; you store key -> address. Requests carry the key. The contract stays the
 *      source of truth for entitlement, your DB just maps credential -> address.
 *   2. Signed requests (no server-side secret). Client signs a SIWE-style message per session;
 *      you verify and issue a short-lived JWT carrying the address.
 *
 * Either way the billing check below is identical, and is the only part that touches the chain.
 */

interface Req {
  header(name: string): string | undefined;
  subscriber?: Address;
}
interface Res {
  status(code: number): Res;
  json(body: unknown): void;
}

export function requireSubscription(
  gate: SubscriptionGate,
  resolveAddress: (req: Req) => Promise<Address | undefined>,
) {
  return async (req: Req, res: Res, next: (err?: unknown) => void) => {
    try {
      const address = await resolveAddress(req);
      if (!address) {
        res.status(401).json({ error: "missing or unrecognised API credential" });
        return;
      }

      if (!(await gate.isSubscribed(address))) {
        res.status(402).json({
          error: "no active subscription",
          address,
          hint: "top up USDC and call subscribe(planId) on the billing contract",
        });
        return;
      }

      req.subscriber = address;
      next();
    } catch (err) {
      next(err);
    }
  };
}
