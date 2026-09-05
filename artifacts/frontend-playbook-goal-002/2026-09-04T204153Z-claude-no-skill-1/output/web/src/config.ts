import { defineChain, type Address } from 'viem'

/**
 * Everything here comes from `web/.env.local`, which `npm run deploy` regenerates
 * on every local deploy. Defaults match the local anvil fork so the app still boots
 * (into a setup message) when the env file is missing.
 */

const rawTipJar = import.meta.env.VITE_TIPJAR_ADDRESS?.trim()

export const rpcUrl = import.meta.env.VITE_RPC_URL?.trim() || 'http://127.0.0.1:8545'
export const chainId = Number(import.meta.env.VITE_CHAIN_ID ?? 31337)

/** Canonical Circle USDC on Base -- the same address on the local fork. */
export const usdcAddress = (import.meta.env.VITE_USDC_ADDRESS?.trim() ||
  '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913') as Address

/** Undefined until the contract has been deployed locally. */
export const tipJarAddress = rawTipJar ? (rawTipJar as Address) : undefined

/**
 * Optional local-only convenience: an anvil dev account exposed as a connectable
 * wallet, so the full tip flow can be exercised without installing MetaMask. anvil
 * keeps its dev accounts unlocked, so it signs for this address itself -- no private
 * key ever reaches the browser. Unset outside local development.
 */
const rawDevWallet = import.meta.env.VITE_DEV_WALLET_ADDRESS?.trim()
export const devWalletAddress = rawDevWallet ? (rawDevWallet as Address) : undefined

export const USDC_DECIMALS = 6
export const MAX_MESSAGE_BYTES = 200

/**
 * The local node forks Base but keeps chain id 31337, so a browser wallet can never
 * mistake it for the real network (and real Base funds can never be sent here).
 */
export const localChain = defineChain({
  id: chainId,
  name: 'Base Local Fork',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [rpcUrl] } },
  testnet: true,
})
