import { NextResponse } from 'next/server'
import { handler } from '@/server/http'
import { indexerStatus } from '@/server/indexerState'
import { publicClient } from '@/server/chainClient'
import { chainId, toolshedAddress } from '@/chain/config'

export const dynamic = 'force-dynamic'

/**
 * Deploy check and monitoring target: is the app talking to the right chain, and
 * how far behind is the indexer?
 */
export const GET = handler(async () => {
  const head = await publicClient.getBlockNumber()
  const { lastIndexedBlock } = indexerStatus()
  return NextResponse.json({
    chainId,
    toolshed: toolshedAddress,
    head: Number(head),
    lastIndexedBlock,
    blocksBehind: lastIndexedBlock === null ? null : Number(head) - lastIndexedBlock,
  })
})
