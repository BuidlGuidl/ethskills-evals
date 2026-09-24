import { NextResponse } from 'next/server'
import { handler } from '@/server/http'
import { currentMember } from '@/server/session'
import { getProfile } from '@/server/members'
import { trackRecord } from '@/server/reputation'

export const dynamic = 'force-dynamic'

export const GET = handler(async () => {
  const address = await currentMember()
  if (!address) return NextResponse.json({ address: null })
  const record = trackRecord(address)
  return NextResponse.json({
    address,
    profile: getProfile(address) ?? null,
    record: { ...record, lateFeesEarned: record.lateFeesEarned.toString() },
  })
})
