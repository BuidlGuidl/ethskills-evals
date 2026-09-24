import { NextResponse } from 'next/server'
import { handler, badRequest } from '@/server/http'
import { requireMember } from '@/server/session'
import { saveProfile } from '@/server/members'

export const POST = handler(async (request: Request) => {
  const address = await requireMember()
  const body = (await request.json()) as { displayName?: string; unitLabel?: string }
  const displayName = (body.displayName ?? '').trim().slice(0, 60)
  const unitLabel = (body.unitLabel ?? '').trim().slice(0, 40)
  if (!displayName) badRequest('A display name helps neighbours know who you are')
  saveProfile({ address, displayName, unitLabel })
  return NextResponse.json({ ok: true })
})
