import { createConfig, http } from "wagmi";
import { mainnet } from "wagmi/chains";
import { coinbaseWallet, injected, walletConnect } from "wagmi/connectors";

import { APP_NAME } from "../constants";

export const ethereumRpcUrl = import.meta.env.VITE_ETHEREUM_RPC_URL?.trim();
export const isRpcConfigured = Boolean(ethereumRpcUrl);

const walletConnectProjectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID?.trim();

const connectors = [
  injected({ shimDisconnect: true }),
  coinbaseWallet({ appName: APP_NAME }),
];

if (walletConnectProjectId) {
  connectors.push(
    walletConnect({
      projectId: walletConnectProjectId,
      metadata: {
        name: APP_NAME,
        description: "Send USDC on Ethereum mainnet.",
        url: window.location.origin,
        icons: [`${window.location.origin}/favicon.svg`],
      },
      showQrModal: true,
    }),
  );
}

export const wagmiConfig = createConfig({
  chains: [mainnet],
  connectors,
  transports: {
    [mainnet.id]: http(ethereumRpcUrl || "https://rpc.not-configured.invalid"),
  },
});
