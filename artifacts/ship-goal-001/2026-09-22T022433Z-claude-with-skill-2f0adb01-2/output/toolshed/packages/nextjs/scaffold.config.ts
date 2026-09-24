import * as chains from "viem/chains";

export type BaseConfig = {
  targetNetworks: readonly chains.Chain[];
  pollingInterval: number;
  alchemyApiKey: string;
  rpcOverrides?: Record<number, string>;
  walletConnectProjectId: string;
  burnerWalletMode: "localNetworksOnly" | "allNetworks" | "disabled";
};

export type ScaffoldConfig = BaseConfig;

export const DEFAULT_ALCHEMY_API_KEY = "IZYEU2cWBgnFmgiTAgpWD";

/**
 * Which chain this shed runs on. Set NEXT_PUBLIC_TARGET_CHAIN in .env.local:
 *   foundry (default) — local Anvil, what `yarn chain` starts
 *   baseSepolia       — Base testnet, for a dry run with the association
 *   base              — production
 * Kept as an env var rather than an edit-this-file constant so the same commit can be deployed to
 * a testnet preview and to production.
 */
const TARGET_CHAINS = {
  foundry: chains.foundry,
  baseSepolia: chains.baseSepolia,
  base: chains.base,
} as const;

const targetChain =
  TARGET_CHAINS[(process.env.NEXT_PUBLIC_TARGET_CHAIN as keyof typeof TARGET_CHAINS) || "foundry"] ??
  TARGET_CHAINS.foundry;

const scaffoldConfig = {
  // The networks on which your DApp is live
  targetNetworks: [targetChain],
  // Base produces a block every 2 seconds, so poll a little faster than the SE-2 default.
  pollingInterval: targetChain.id === chains.base.id || targetChain.id === chains.baseSepolia.id ? 2000 : 3000,
  // This is ours Alchemy's default API key.
  // You can get your own at https://dashboard.alchemyapi.io
  // It's recommended to store it in an env variable:
  // .env.local for local testing, and in the Vercel/system env config for live apps.
  alchemyApiKey: process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || DEFAULT_ALCHEMY_API_KEY,
  // If you want to use a different RPC for a specific network, you can add it here.
  // The key is the chain ID, and the value is the HTTP RPC URL
  rpcOverrides: {
    // Example:
    // [chains.mainnet.id]: "https://mainnet.rpc.buidlguidl.com",
  },
  // This is ours WalletConnect's default project ID.
  // You can get your own at https://cloud.walletconnect.com
  // It's recommended to store it in an env variable:
  // .env.local for local testing, and in the Vercel/system env config for live apps.
  walletConnectProjectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID || "3a8170812b534d0ff9d794f19a901d64",
  // Configure Burner Wallet visibility:
  // - "localNetworksOnly": only show when all target networks are local (hardhat/anvil)
  // - "allNetworks": show on any configured target networks
  // - "disabled": completely disable
  burnerWalletMode: "localNetworksOnly",
} as const satisfies ScaffoldConfig;

export default scaffoldConfig;
