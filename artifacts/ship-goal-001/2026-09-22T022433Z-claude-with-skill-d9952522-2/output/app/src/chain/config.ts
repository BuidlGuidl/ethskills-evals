import { base, baseSepolia, foundry } from 'viem/chains'
import type { Chain } from 'viem'
import { getAddress, type Address } from 'viem'

/**
 * One chain per deployment, taken from the environment so that a developer can
 * point the same build at anvil, Base Sepolia or Base mainnet.
 */
const chains: Record<number, Chain> = {
  [base.id]: base,
  [baseSepolia.id]: baseSepolia,
  [foundry.id]: foundry,
}

/** Circle native USDC, verified onchain (`cast call <addr> "symbol()(string)"`). */
export const knownUsdc: Record<number, Address> = {
  [base.id]: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  [baseSepolia.id]: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
}

function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing environment variable ${name} (see .env.example)`)
  return value
}

export const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? baseSepolia.id)

export const chain: Chain = (() => {
  const c = chains[chainId]
  if (!c) throw new Error(`Unsupported NEXT_PUBLIC_CHAIN_ID ${chainId}`)
  return c
})()

export const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || chain.rpcUrls.default.http[0]

export const toolshedAddress = getAddress(
  required('NEXT_PUBLIC_TOOLSHED_ADDRESS', process.env.NEXT_PUBLIC_TOOLSHED_ADDRESS),
)

export const usdcAddress = getAddress(
  required(
    'NEXT_PUBLIC_USDC_ADDRESS',
    process.env.NEXT_PUBLIC_USDC_ADDRESS || knownUsdc[chainId],
  ),
)

export const USDC_DECIMALS = 6

export const explorerTxUrl = (hash: string) =>
  chain.blockExplorers?.default ? `${chain.blockExplorers.default.url}/tx/${hash}` : undefined
