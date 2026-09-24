"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode, useState } from "react";
import { WagmiProvider, createConfig, http } from "wagmi";
import { mainnet } from "wagmi/chains";
import { injected } from "wagmi/connectors";

const mainnetRpcUrl = import.meta.env.VITE_ETHEREUM_RPC_URL || "https://eth.llamarpc.com";

export const rpcHealth = {
  configured: Boolean(import.meta.env.VITE_ETHEREUM_RPC_URL),
  url: mainnetRpcUrl,
};

const config = createConfig({
  chains: [mainnet],
  connectors: [
    injected({
      shimDisconnect: true,
    }),
  ],
  transports: {
    [mainnet.id]: http(mainnetRpcUrl, {
      batch: true,
      retryCount: 2,
      timeout: 10_000,
    }),
  },
});

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            retry: 1,
            staleTime: 4_000,
          },
        },
      }),
  );

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
