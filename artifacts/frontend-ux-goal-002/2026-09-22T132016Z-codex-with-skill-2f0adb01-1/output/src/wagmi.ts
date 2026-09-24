import { createConfig, fallback, http } from "wagmi";
import { mainnet } from "wagmi/chains";
import { coinbaseWallet, injected } from "wagmi/connectors";

const mainnetRpcUrl = import.meta.env.VITE_MAINNET_RPC_URL as string | undefined;

const transports = mainnetRpcUrl
  ? [http(mainnetRpcUrl), http("https://ethereum-rpc.publicnode.com")]
  : [
      http("https://ethereum-rpc.publicnode.com"),
      http("https://cloudflare-eth.com"),
    ];

export const hasDedicatedRpc = Boolean(mainnetRpcUrl);

export const wagmiConfig = createConfig({
  chains: [mainnet],
  connectors: [
    injected({ shimDisconnect: true }),
    coinbaseWallet({ appName: "USDC Pay" }),
  ],
  pollingInterval: 4_000,
  transports: {
    [mainnet.id]: fallback(transports, {
      rank: false,
      retryCount: 2,
      retryDelay: 800,
    }),
  },
});
