"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, createConfig, http } from "wagmi";
import { foundry, sepolia } from "wagmi/chains";
import { injected } from "wagmi/connectors";
import { useState } from "react";

const configuredId = Number(process.env.NEXT_PUBLIC_CHAIN_ID || 31337);
const config = configuredId === sepolia.id
  ? createConfig({ chains: [sepolia], connectors: [injected()], transports: { [sepolia.id]: http() }, ssr: true })
  : createConfig({ chains: [foundry], connectors: [injected()], transports: { [foundry.id]: http() }, ssr: true });

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient());
  return <WagmiProvider config={config}><QueryClientProvider client={client}>{children}</QueryClientProvider></WagmiProvider>;
}
