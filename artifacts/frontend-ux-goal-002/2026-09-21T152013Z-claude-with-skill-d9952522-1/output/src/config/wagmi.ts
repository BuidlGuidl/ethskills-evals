import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http } from "wagmi";
import { mainnet } from "wagmi/chains";

export const APP_NAME = "Settle";
export const TARGET_CHAIN = mainnet;

const rpcUrl = process.env.NEXT_PUBLIC_MAINNET_RPC_URL;
const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

if (process.env.NODE_ENV === "production") {
  if (!rpcUrl) throw new Error("NEXT_PUBLIC_MAINNET_RPC_URL is required (dedicated mainnet RPC).");
  if (!walletConnectProjectId) throw new Error("NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is required.");
} else if (!rpcUrl) {
  console.warn("NEXT_PUBLIC_MAINNET_RPC_URL not set — falling back to rate-limited public RPC (dev only).");
}

export const wagmiConfig = getDefaultConfig({
  appName: APP_NAME,
  projectId: walletConnectProjectId ?? "dev-placeholder",
  chains: [TARGET_CHAIN],
  transports: { [TARGET_CHAIN.id]: http(rpcUrl) },
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
