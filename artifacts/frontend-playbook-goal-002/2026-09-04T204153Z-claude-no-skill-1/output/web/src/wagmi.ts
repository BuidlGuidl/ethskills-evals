import { createConfig, http, type CreateConnectorFn } from 'wagmi'
import { injected } from 'wagmi/connectors'
import { mock } from 'wagmi/connectors/mock'
import { devWalletAddress, localChain, rpcUrl } from './config'

const connectors: CreateConnectorFn[] = [injected()]

// Local development only: see `devWalletAddress` in config.ts.
if (devWalletAddress) {
  connectors.push(mock({ accounts: [devWalletAddress] }))
}

export const wagmiConfig = createConfig({
  chains: [localChain],
  connectors,
  transports: { [localChain.id]: http(rpcUrl) },
})

declare module 'wagmi' {
  interface Register {
    config: typeof wagmiConfig
  }
}
