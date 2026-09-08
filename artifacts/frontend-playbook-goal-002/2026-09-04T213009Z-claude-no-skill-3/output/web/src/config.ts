import { defineChain, getAddress, type Address } from 'viem'
import { base } from 'viem/chains'

/** USDC on Base — the token this jar collects tips in. */
export const BASE_USDC: Address = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'

const env = import.meta.env

function optionalAddress(value: string | undefined): Address | undefined {
  if (!value) return undefined
  try {
    return getAddress(value)
  } catch {
    console.warn(`Ignoring malformed address in .env: ${value}`)
    return undefined
  }
}

export const localRpcUrl = env.VITE_LOCAL_RPC_URL ?? 'http://127.0.0.1:8545'
export const localChainId = Number(env.VITE_LOCAL_CHAIN_ID ?? 31337)

/**
 * The Anvil chain from `npm run chain`. It is forked from Base, so the real
 * USDC contract is there, but it runs under its own chain id so wallets keep it
 * separate from Base itself.
 */
export const localChain = defineChain({
  id: localChainId,
  name: 'Anvil (Base fork)',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [localRpcUrl] } },
  testnet: true,
})

export type Deployment = {
  tipJar?: Address
  usdc: Address
}

/** Where the jar and its token live, per chain. */
export const deployments: Record<number, Deployment> = {
  [base.id]: {
    // Set VITE_TIPJAR_ADDRESS_BASE once a jar exists on Base mainnet.
    tipJar: optionalAddress(env.VITE_TIPJAR_ADDRESS_BASE),
    usdc: BASE_USDC,
  },
  [localChain.id]: {
    // Written by scripts/deploy-local.sh into web/.env.local.
    tipJar: optionalAddress(env.VITE_TIPJAR_ADDRESS),
    usdc: optionalAddress(env.VITE_USDC_ADDRESS) ?? BASE_USDC,
  },
}

/** Chain the app defaults to before a wallet is connected. */
export const defaultChain = deployments[localChain.id]?.tipJar ? localChain : base

export const walletConnectProjectId: string | undefined = env.VITE_WALLETCONNECT_PROJECT_ID

/** Local-only: address of an unlocked Anvil account to transact as. */
export const devWallet = optionalAddress(env.VITE_DEV_WALLET)

export function deploymentFor(chainId: number | undefined): Deployment | undefined {
  return chainId === undefined ? undefined : deployments[chainId]
}

export function explorerTxUrl(chainId: number | undefined, hash: string): string | undefined {
  if (chainId === base.id) return `https://basescan.org/tx/${hash}`
  return undefined
}

export function explorerAddressUrl(chainId: number | undefined, address: string): string | undefined {
  if (chainId === base.id) return `https://basescan.org/address/${address}`
  return undefined
}
