import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { defineChain } from "viem";
import { base } from "viem/chains";

// Local anvil chain (chainId 31337). This is what the app talks to for local
// development. `base` is included too so the same UI can target Base mainnet by
// switching the `ACTIVE_CHAIN` below.
export const anvil = defineChain({
  id: 31337,
  name: "Anvil (localhost)",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["http://127.0.0.1:8545"] },
  },
});

// Switch this to `base` (and update the addresses in contracts.ts) to point the
// app at Base mainnet instead of the local anvil node.
export const ACTIVE_CHAIN = anvil;

// WalletConnect projectId. MetaMask / injected wallets work locally without it;
// a real id (from https://cloud.reown.com) is only needed for WalletConnect-based
// wallets. Provide one via VITE_WC_PROJECT_ID to enable them.
const projectId = import.meta.env.VITE_WC_PROJECT_ID ?? "local-dev-tip-jar";

export const config = getDefaultConfig({
  appName: "USDC Tip Jar",
  projectId,
  chains: [anvil, base],
  ssr: false,
});
