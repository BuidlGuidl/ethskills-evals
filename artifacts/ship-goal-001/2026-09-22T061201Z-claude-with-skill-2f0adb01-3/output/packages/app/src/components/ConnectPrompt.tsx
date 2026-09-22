"use client";

import { ConfigWarning } from "./ConfigWarning";
import { ConnectButton } from "./ConnectButton";

/**
 * What a screen shows before there is a wallet: an actual connect control, not a sentence telling
 * the visitor to go and find one. Keeps the config warning visible, because a misconfigured
 * deployment looks exactly like a disconnected one otherwise.
 */
export function ConnectPrompt({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4">
      <ConfigWarning />
      <div className="card flex flex-col items-start gap-3 p-6">
        <p className="text-sm text-shed-600">{children}</p>
        <ConnectButton />
      </div>
    </div>
  );
}
