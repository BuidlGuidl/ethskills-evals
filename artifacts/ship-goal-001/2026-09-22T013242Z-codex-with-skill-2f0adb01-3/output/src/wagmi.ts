import { createConfig, http } from "wagmi";
import { baseSepolia, hardhat } from "wagmi/chains";
import { injected } from "wagmi/connectors";

export const supportedChains = [hardhat, baseSepolia] as const;

export const wagmiConfig = createConfig({
  chains: supportedChains,
  connectors: [injected()],
  transports: {
    [hardhat.id]: http(import.meta.env.VITE_LOCAL_RPC_URL ?? "http://127.0.0.1:8545"),
    [baseSepolia.id]: http(import.meta.env.VITE_BASE_SEPOLIA_RPC_URL ?? "https://sepolia.base.org"),
  },
  pollingInterval: 4_000,
});
