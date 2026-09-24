import { NextResponse } from 'next/server'
import { getAddress } from 'viem'
import { handler, badRequest, notFound } from '@/server/http'
import { requireMember, HttpError } from '@/server/session'
import { isOnRoster } from '@/server/chainClient'
import { getTool } from '@/server/tools'
import { createRequest, hasOpenRequest } from '@/server/requests'

/** Ask to borrow a tool for a few days. Free: nothing touches the chain yet. */
export const POST = handler(async (request: Request) => {
  const address = await requireMember()
  if (!(await isOnRoster(address))) {
    throw new HttpError(403, 'Only members on the association roster can borrow')
  }

  const body = (await request.json()) as { toolUuid?: string; days?: number; note?: string }
  const tool = body.toolUuid ? getTool(body.toolUuid) : undefined
  if (!tool) notFound('No such tool')
  if (tool.retired) badRequest('That listing has been retired')
  if (getAddress(tool.ownerAddress) === address) badRequest('That is your own tool')

  const days = Number(body.days)
  if (!Number.isInteger(days) || days < 1) badRequest('How many days?')
  if (days > tool.maxLoanDays) badRequest(`The owner lends this for up to ${tool.maxLoanDays} days`)
  if (hasOpenRequest(tool.uuid, address)) badRequest('You already have a request open on this tool')

  const created = createRequest({
    toolUuid: tool.uuid,
    borrowerAddress: address,
    days,
    note: String(body.note ?? '').trim().slice(0, 500),
  })
  return NextResponse.json({ id: created.id })
})
