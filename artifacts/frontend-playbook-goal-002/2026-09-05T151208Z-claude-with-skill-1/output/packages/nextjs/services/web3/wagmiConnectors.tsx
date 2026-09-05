import { connectorsForWallets } from "@rainbow-me/rainbowkit";
import {
  base,
  ledgerWallet,
  metaMaskWallet,
  rainbowWallet,
  safeWallet,
  walletConnectWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { rainbowkitBurnerWallet } from "burner-connector";
import * as chains from "viem/chains";
import scaffoldConfig, { type ScaffoldConfig } from "~~/scaffold.config";

const { burnerWalletMode, targetNetworks } = scaffoldConfig as ScaffoldConfig;

const hasOnlyLocalTargetNetworks = targetNetworks.every(network => network.id === (chains.hardhat as chains.Chain).id);
const showBurnerWallet =
  burnerWalletMode !== "disabled" && (burnerWalletMode === "allNetworks" || hasOnlyLocalTargetNetworks);

// The burner wallet builds its own viem client from `chain.rpcUrls.default` and never sees
// wagmi's transports, so without this it would sign against a different node than the one the
// rest of the app reads from whenever `rpcOverrides` points somewhere else.
rainbowkitBurnerWallet.rpcUrls = scaffoldConfig.rpcOverrides;

const wallets = [
  metaMaskWallet,
  walletConnectWallet,
  ledgerWallet,
  base,
  rainbowWallet,
  safeWallet,
  ...(showBurnerWallet ? [rainbowkitBurnerWallet] : []),
];

/**
 * wagmi connectors for the wagmi context
 */
export const wagmiConnectors = () => {
  // Only create connectors on client-side to avoid SSR issues
  // TODO: update when https://github.com/rainbow-me/rainbowkit/issues/2476 is resolved
  if (typeof window === "undefined") {
    return [];
  }

  return connectorsForWallets(
    [
      {
        groupName: "Supported Wallets",
        wallets,
      },
    ],

    {
      appName: "scaffold-eth-2",
      projectId: scaffoldConfig.walletConnectProjectId,
    },
  );
};
