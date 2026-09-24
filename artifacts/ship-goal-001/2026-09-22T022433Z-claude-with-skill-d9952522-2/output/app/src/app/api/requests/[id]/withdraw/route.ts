import { NextResponse } from 'next/server'
import { getAddress } from 'viem'
import { handler, badRequest, forbidden, notFound } from '@/server/http'
import { requireMember } from '@/server/session'
import { getRequest, setRequestStatus } from '@/server/requests'

/** Borrower changed their mind before funding the deposit. */
export const POST = handler(
  async (_req: Request, context: { params: Promise<{ id: string }> }) => {
    const address = await requireMember()
    const { id } = await context.params
    const request = getRequest(Number(id))
    if (!request) notFound('No such request')
    if (getAddress(request.borrowerAddress) !== address) forbidden('That is not your request')
    if (request.status === 'started') badRequest('That loan has already started')

    setRequestStatus(request.id, 'withdrawn')
    return NextResponse.json({ ok: true })
  },
)
