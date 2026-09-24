import { createConfig, http } from "wagmi";
import { mainnet } from "wagmi/chains";
import { coinbaseWallet, injected, metaMask } from "wagmi/connectors";

const ethereumRpcUrl = import.meta.env.VITE_ETHEREUM_RPC_URL as string | undefined;

export const config = createConfig({
  chains: [mainnet],
  connectors: [
    injected(),
    metaMask(),
    coinbaseWallet({
      appName: "USDC Pay",
    }),
  ],
  transports: {
    [mainnet.id]: http(ethereumRpcUrl),
  },
});
