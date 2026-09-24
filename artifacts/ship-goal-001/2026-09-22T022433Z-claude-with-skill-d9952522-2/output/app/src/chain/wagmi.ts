'use client'

import { createConfig, http } from 'wagmi'
import { injected } from 'wagmi/connectors/injected'
import { coinbaseWallet } from 'wagmi/connectors/coinbaseWallet'
import { chain, rpcUrl } from './config'

/**
 * Two connectors, in the order most neighbours will want them:
 *
 * 1. Coinbase Wallet — offers the Base Smart Wallet, which onboards with a
 *    passkey: no extension, no seed phrase. This is the path for the ~290
 *    members who have never held a private key.
 * 2. Injected — for the handful who already run MetaMask or Rabby.
 *
 * Both produce addresses the contract accepts. A Smart Wallet is a contract
 * account, and `Toolshed` verifies owner signatures through ERC-1271, so a
 * passkey wallet can sign loan offers and return receipts like any EOA.
 */
export const wagmiConfig = createConfig({
  chains: [chain],
  connectors: [coinbaseWallet({ appName: 'Toolshed', preference: { options: 'all' } }), injected()],
  transports: { [chain.id]: http(rpcUrl) },
  ssr: true,
})

declare module 'wagmi' {
  interface Register {
    config: typeof wagmiConfig
  }
}
