import { NextResponse } from 'next/server'
import { handler, badRequest } from '@/server/http'
import { sessionCookie, verifySignIn } from '@/server/session'
import { isOnRoster } from '@/server/chainClient'
import { setRosterFlag } from '@/server/members'

/** Step 2 of sign-in: check the signature, then set the session cookie. */
export const POST = handler(async (request: Request) => {
  const body = (await request.json()) as {
    address?: string
    nonce?: string
    signature?: `0x${string}`
  }
  if (!body.address || !body.nonce || !body.signature) badRequest('address, nonce and signature required')

  const host = new URL(request.url).host
  const address = await verifySignIn({
    address: body.address,
    nonce: body.nonce,
    signature: body.signature,
    host,
  })

  // Refresh the roster flag on sign-in so a member added onchain a minute ago
  // does not have to wait for the next indexer pass to be able to post.
  const onRoster = await isOnRoster(address)
  setRosterFlag(address, onRoster)

  const cookie = sessionCookie(address)
  const response = NextResponse.json({ address, onRoster })
  response.cookies.set(cookie.name, cookie.value, cookie.options)
  return response
})
