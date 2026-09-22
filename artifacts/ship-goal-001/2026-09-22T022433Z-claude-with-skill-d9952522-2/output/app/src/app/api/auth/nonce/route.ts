import { NextResponse } from 'next/server'
import { handler, badRequest } from '@/server/http'
import { issueNonce, signInMessage } from '@/server/session'
import { isAddress, getAddress } from 'viem'

/** Step 1 of sign-in: hand the browser a nonce and the exact message to sign. */
export const POST = handler(async (request: Request) => {
  const { address } = (await request.json()) as { address?: string }
  if (!address || !isAddress(address)) badRequest('address required')
  const checksummed = getAddress(address)
  const nonce = issueNonce()
  const host = new URL(request.url).host
  return NextResponse.json({ nonce, message: signInMessage(checksummed, nonce, host) })
})
