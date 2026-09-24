"use client";

import "@rainbow-me/rainbowkit/styles.css";
import { darkTheme, lightTheme, RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { WagmiProvider } from "wagmi";
import { TARGET_CHAIN } from "@/lib/constants";
import { wagmiConfig } from "@/lib/wagmi";

const accentColor = "#2775ca";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          initialChain={TARGET_CHAIN}
          theme={{
            lightMode: lightTheme({ accentColor }),
            darkMode: darkTheme({ accentColor }),
          }}
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
