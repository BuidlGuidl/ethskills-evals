import { NextResponse } from 'next/server'
import { getAddress } from 'viem'
import { handler, forbidden, notFound } from '@/server/http'
import { requireMember } from '@/server/session'
import { getTool, setToolRetired } from '@/server/tools'

/** Take a listing off the browse screen (or put it back). Owner only. */
export const POST = handler(
  async (request: Request, context: { params: Promise<{ uuid: string }> }) => {
    const address = await requireMember()
    const { uuid } = await context.params
    const tool = getTool(uuid)
    if (!tool) notFound('No such tool')
    if (getAddress(tool.ownerAddress) !== address) forbidden('That is not your tool')

    const { retired } = (await request.json().catch(() => ({ retired: true }))) as {
      retired?: boolean
    }
    setToolRetired(uuid, retired ?? true)
    return NextResponse.json({ ok: true, retired: retired ?? true })
  },
)
