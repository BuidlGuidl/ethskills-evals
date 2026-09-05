import { createConfig, http } from 'wagmi'
import { base } from 'wagmi/chains'
import { coinbaseWallet, injected, mock, walletConnect } from 'wagmi/connectors'
import { devWallet, localChain, localRpcUrl, walletConnectProjectId } from './config'

const connectors = [
  injected(),
  coinbaseWallet({ appName: 'USDC Tip Jar' }),
  // WalletConnect needs a project id from https://cloud.reown.com; it is
  // optional, and the app works without it.
  ...(walletConnectProjectId ? [walletConnect({ projectId: walletConnectProjectId })] : []),
  // Local convenience: VITE_DEV_WALLET adds a connector that signs as one of
  // Anvil's unlocked accounts, so the app can be driven without a browser
  // wallet installed. Never set this against a real network.
  ...(devWallet ? [mock({ accounts: [devWallet], features: { reconnect: true } })] : []),
]

export const wagmiConfig = createConfig({
  chains: [localChain, base],
  connectors,
  transports: {
    [localChain.id]: http(localRpcUrl),
    [base.id]: http(),
  },
})

declare module 'wagmi' {
  interface Register {
    config: typeof wagmiConfig
  }
}
