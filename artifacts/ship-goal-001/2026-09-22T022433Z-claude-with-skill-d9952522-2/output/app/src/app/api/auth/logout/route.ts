import { NextResponse } from 'next/server'
import { handler } from '@/server/http'
import { sessionCookieName } from '@/server/session'

export const POST = handler(async () => {
  const response = NextResponse.json({ ok: true })
  response.cookies.delete(sessionCookieName)
  return response
})
