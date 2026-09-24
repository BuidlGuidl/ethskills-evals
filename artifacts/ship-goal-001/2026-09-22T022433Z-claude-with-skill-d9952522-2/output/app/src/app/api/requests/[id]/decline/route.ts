import { NextResponse } from 'next/server'
import { getAddress } from 'viem'
import { handler, badRequest, forbidden, notFound } from '@/server/http'
import { requireMember } from '@/server/session'
import { getRequest, setRequestStatus } from '@/server/requests'
import { getTool } from '@/server/tools'

/** Owner says no. Costs nothing and tells the borrower to stop waiting. */
export const POST = handler(
  async (_req: Request, context: { params: Promise<{ id: string }> }) => {
    const address = await requireMember()
    const { id } = await context.params
    const request = getRequest(Number(id))
    if (!request) notFound('No such request')
    const tool = getTool(request.toolUuid)
    if (!tool) notFound('No such tool')
    if (getAddress(tool.ownerAddress) !== address) forbidden('That is not your tool')
    if (request.status === 'started') badRequest('That loan has already started')

    setRequestStatus(request.id, 'declined')
    return NextResponse.json({ ok: true })
  },
)
