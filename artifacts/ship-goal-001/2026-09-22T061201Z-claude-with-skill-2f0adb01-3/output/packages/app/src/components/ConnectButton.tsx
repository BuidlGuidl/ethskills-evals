"use client";

import { useState } from "react";
import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { activeChain } from "@/lib/chain";
import { shortAddress } from "@/lib/format";
import { humanError } from "@/lib/errors";

/**
 * Wallet control. One button until it is clicked, then the wallet choices — a grid of tool cards
 * each showing three connectors is noise. Handles the two things that block every write: not
 * being connected, and being on the wrong chain.
 */
export function ConnectButton({ label = "Connect wallet" }: { label?: string }) {
  const { address, chainId, isConnected } = useAccount();
  const { connectors, connect, isPending, error } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: switching } = useSwitchChain();
  const [choosing, setChoosing] = useState(false);

  if (!isConnected) {
    if (!choosing) {
      return (
        <button className="btn-primary" onClick={() => setChoosing(true)}>
          {label}
        </button>
      );
    }
    return (
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {connectors.map((connector) => (
            <button
              key={connector.uid}
              className="btn-secondary"
              disabled={isPending}
              onClick={() => connect({ connector })}
            >
              {isPending ? "Connecting…" : connector.name}
            </button>
          ))}
        </div>
        {error && <p className="text-xs text-red-700">{humanError(error)}</p>}
      </div>
    );
  }

  if (chainId !== activeChain.id) {
    return (
      <button className="btn-primary" disabled={switching} onClick={() => switchChain({ chainId: activeChain.id })}>
        {switching ? "Switching…" : `Switch to ${activeChain.name}`}
      </button>
    );
  }

  return (
    <button className="btn-secondary font-mono" onClick={() => disconnect()} title="Disconnect">
      {address ? shortAddress(address) : ""}
    </button>
  );
}
