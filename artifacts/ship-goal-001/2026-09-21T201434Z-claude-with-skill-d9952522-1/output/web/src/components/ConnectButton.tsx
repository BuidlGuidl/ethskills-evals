"use client";

import { useAccount, useConnect, useDisconnect } from "wagmi";

export function ConnectButton() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();

  if (isConnected && address) {
    return (
      <button className="secondary" onClick={() => disconnect()} title={address}>
        {address.slice(0, 6)}…{address.slice(-4)}
      </button>
    );
  }

  return (
    <button disabled={isPending} onClick={() => connect({ connector: connectors[0] })}>
      {isPending ? "Connecting…" : "Sign in"}
    </button>
  );
}
