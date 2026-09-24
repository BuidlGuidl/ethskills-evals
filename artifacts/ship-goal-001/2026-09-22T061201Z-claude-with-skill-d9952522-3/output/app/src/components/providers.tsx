"use client";

import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import {useState} from "react";
import {WagmiProvider, createConfig, http} from "wagmi";
import {base, baseSepolia, foundry} from "wagmi/chains";
import {coinbaseWallet, injected} from "wagmi/connectors";

/**
 * Wallet wiring.
 *
 * Coinbase Wallet first, deliberately: most of a neighbourhood association has never held a
 * token, and its smart-wallet flow gets someone from nothing to a funded USDC address on Base
 * without a seed phrase or a browser extension. `injected` is there for the handful of members
 * who already have MetaMask.
 */
function buildConfig() {
  const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? base.id);
  const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL;
  const connectors = [
    coinbaseWallet({appName: "Toolshed", preference: "all"}),
    injected({shimDisconnect: true}),
  ];

  // Written out per chain rather than indexed by a variable so the transports map stays exactly
  // as wide as `chains` — wagmi's types will not accept a computed key here.
  if (chainId === foundry.id) {
    return createConfig({
      chains: [foundry],
      connectors,
      transports: {[foundry.id]: http(rpcUrl)},
      ssr: true,
    });
  }
  return chainId === baseSepolia.id
    ? createConfig({
        chains: [baseSepolia],
        connectors,
        transports: {[baseSepolia.id]: http(rpcUrl)},
        ssr: true,
      })
    : createConfig({
        chains: [base],
        connectors,
        transports: {[base.id]: http(rpcUrl)},
        ssr: true,
      });
}

export function Providers({children}: {children: React.ReactNode}) {
  const [wagmiConfig] = useState(buildConfig);
  const [queryClient] = useState(
    () => new QueryClient({defaultOptions: {queries: {staleTime: 10_000, retry: 1}}}),
  );

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
