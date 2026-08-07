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

// Target network is env-driven so the same codebase runs against the local Base
// fork during development and against Base mainnet in the production IPFS build.
//  - unset / "foundry": local Anvil fork of Base (chain id 31337) — default
//  - "base": Base mainnet (chain id 8453) — set for the IPFS production build
//
// The `as typeof chains.foundry` cast keeps the *compile-time* configured chain a
// single id so contract types stay narrow (TipJar + USDC). The runtime value still
// switches to Base when NEXT_PUBLIC_TARGET_NETWORK=base; hooks resolve the deployed
// contract by the live chain id. Deploy TipJar to Base before the production build
// (see DEPLOY.md) so its address lands in deployedContracts for chain 8453.
const targetNetwork = (
  process.env.NEXT_PUBLIC_TARGET_NETWORK === "base" ? chains.base : chains.foundry
) as typeof chains.foundry;

const scaffoldConfig = {
  // The networks on which your DApp is live
  targetNetworks: [targetNetwork],
  // The interval at which your front-end polls the RPC servers for new data (it has no effect if you only target the local network (default is 4000))
  pollingInterval: 3000,
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
