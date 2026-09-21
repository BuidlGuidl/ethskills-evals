// Shared config for payout.ts and sweep.ts.
//
// Every address below was checked against live chain state on 2026-09-21
// (Celo mainnet + Ethereum mainnet); NOTES.md says how to re-check them.
// sweep.ts also re-checks the bridge wiring on-chain every time it runs.

import { defineChain, getAddress, isAddress, type Address, type Hex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { celo as viemCelo, mainnet } from 'viem/chains'

// ---- Celo (L2, chain id 42220) ------------------------------------------------

/** Circle-issued native USDC on Celo. 6 decimals. NOT USDC.e / bridged USDC. */
export const CELO_USDC: Address = '0xcebA9300f2b948710d2653dD7B07f33A8B32118C'
export const CELO_USDC_DECIMALS = 6

/** OP Stack predeploy. Native-CELO withdrawals to L1 start here. */
export const L2_TO_L1_MESSAGE_PASSER: Address = '0x4200000000000000000000000000000000000016'

// ---- Ethereum mainnet (L1) side of the Celo bridge ------------------------------
// Source: ethereum-optimism/superchain-registry superchain/configs/mainnet/celo.toml,
// cross-checked on-chain (portal.systemConfig(), systemConfig.gasPayingToken(), ...).

/** CELO as an ERC-20 on Ethereum ("Celo native asset", 18 decimals). This is what
 *  the treasury receives. The treasury does NOT receive ETH. */
export const L1_CELO_TOKEN: Address = '0x057898f3C43F129a17517B9056D23851F124b19f'
export const CELO_OPTIMISM_PORTAL: Address = '0xc5c5D157928BDBD2ACf6d0777626b6C75a9EAEDC'
export const CELO_SYSTEM_CONFIG: Address = '0x89E31965D844a309231B1f17759Ccaf1b7c09861'
export const CELO_DISPUTE_GAME_FACTORY: Address = '0xFbAC162162f4009Bb007C6DeBC36B1dAC10aF683'

/** viem's built-in `celo` chain has no L1 contract addresses, so the OP Stack
 *  withdrawal actions can't find the portal without this. */
export const celo = defineChain({
  ...viemCelo,
  sourceId: mainnet.id,
  contracts: {
    ...viemCelo.contracts,
    portal: { [mainnet.id]: { address: CELO_OPTIMISM_PORTAL } },
    disputeGameFactory: { [mainnet.id]: { address: CELO_DISPUTE_GAME_FACTORY } },
    // Celo never used an L2OutputOracle on its L2; the portal is fault-proof based.
    l2OutputOracle: { [mainnet.id]: { address: '0x0000000000000000000000000000000000000000' } },
  },
})

export { mainnet }

/** The placeholder from the spec. Scripts refuse to send anything to it. */
export const PLACEHOLDER_TREASURY: Address = '0x1111111111111111111111111111111111111111'

// ---- env / CLI helpers ------------------------------------------------------------

export function requireEnv(name: string): string {
  const v = process.env[name]?.trim()
  if (!v) die(`Missing required env var ${name}. See NOTES.md.`)
  return v
}

export function envAddress(name: string): Address {
  const v = requireEnv(name)
  if (!isAddress(v, { strict: true })) die(`${name}=${v} is not a valid (checksummed) address`)
  return getAddress(v)
}

/** Signing account when broadcasting; address-only when dry-running. */
export function opsAccountOrAddress(send: boolean) {
  const key = process.env.OPS_PRIVATE_KEY?.trim()
  if (key) return privateKeyToAccount(key as Hex)
  if (send) die('OPS_PRIVATE_KEY is required with --send.')
  return envAddress('OPS_ADDRESS')
}

export function die(msg: string): never {
  console.error(`\nERROR: ${msg}`)
  process.exit(1)
}

export function sameAddress(a: string, b: string) {
  return a.toLowerCase() === b.toLowerCase()
}
