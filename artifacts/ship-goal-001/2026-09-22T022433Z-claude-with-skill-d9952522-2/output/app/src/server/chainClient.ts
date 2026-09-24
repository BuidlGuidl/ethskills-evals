import { createPublicClient, http } from 'viem'
import { chain, rpcUrl, toolshedAddress } from '../chain/config'
import { toolshedAbi } from '../chain/toolshedAbi'

/** Server-side read client: roster checks, signature verification, indexing. */
export const publicClient = createPublicClient({
  chain,
  transport: http(rpcUrl),
})

export const toolshed = { address: toolshedAddress, abi: toolshedAbi } as const

/** Is this address on the association roster, according to the contract? */
export async function isOnRoster(address: `0x${string}`): Promise<boolean> {
  return publicClient.readContract({ ...toolshed, functionName: 'isMember', args: [address] })
}
