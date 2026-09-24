"use client";

import { isConfigured } from "@/lib/contracts";
import { activeChain } from "@/lib/chain";

/** Fails loudly at the top of the page rather than silently reading address zero. */
export function ConfigWarning() {
  if (isConfigured) return null;
  return (
    <div className="card border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
      <p className="font-semibold">Not configured yet</p>
      <p>
        Set <code className="font-mono">NEXT_PUBLIC_TOOLSHED_ADDRESS</code> and{" "}
        <code className="font-mono">NEXT_PUBLIC_USDC_ADDRESS</code> in{" "}
        <code className="font-mono">packages/app/.env.local</code> (see <code className="font-mono">.env.example</code>
        ), then restart the dev server. Current chain: {activeChain.name}.
      </p>
    </div>
  );
}
