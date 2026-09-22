"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { WagmiProvider, createConfig, http, type Transport } from "wagmi";
import { coinbaseWallet, injected } from "wagmi/connectors";
import { chain, rpcUrl } from "@/core/chain";

/**
 * Wallet wiring.
 *
 * Coinbase Smart Wallet is listed first on purpose: most of the 300 members
 * are neighbors, not crypto users, and a passkey signup beats asking them to
 * install an extension and write down a seed phrase.
 */
function buildConfig() {
  return createConfig({
    chains: [chain],
    connectors: [
      coinbaseWallet({ appName: "Toolshed", preference: "smartWalletOnly" }),
      injected(),
    ],
    // `chain` is a union of the chains we support, so TypeScript wants a
    // transport for every member. We only ever configure the one selected by
    // NEXT_PUBLIC_CHAIN, which is exactly the chain in `chains` above.
    transports: { [chain.id]: http(rpcUrl) } as Record<number, Transport>,
    ssr: true,
  });
}

export function Providers({ children }: { children: ReactNode }) {
  const [config] = useState(buildConfig);
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
