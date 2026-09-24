import { createConfig, http, injected } from "wagmi";
import { mainnet } from "wagmi/chains";

export const mainnetRpcUrl = import.meta.env.VITE_MAINNET_RPC_URL?.trim() ?? "";
export const isRpcConfigured = mainnetRpcUrl.length > 0;

export const wagmiConfig = createConfig({
  chains: [mainnet],
  connectors: [injected()],
  transports: {
    [mainnet.id]: http(mainnetRpcUrl),
  },
});
