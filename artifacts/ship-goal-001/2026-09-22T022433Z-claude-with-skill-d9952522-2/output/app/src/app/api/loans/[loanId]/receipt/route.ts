import { NextResponse } from 'next/server'
import { getAddress } from 'viem'
import { handler, badRequest, forbidden, notFound } from '@/server/http'
import { requireMember } from '@/server/session'
import { getLoan, saveReturnReceipt } from '@/server/loans'
import { publicClient } from '@/server/chainClient'
import { eip712Domain, returnReceiptTypes } from '@/chain/eip712'
import { now } from '@/server/db'

/**
 * The owner leaves a signed "you gave it back at this time" receipt, which the
 * borrower submits to close the loan themselves. This is what stops a deposit
 * sitting in escrow because the owner is away for a fortnight.
 */
export const POST = handler(
  async (request: Request, context: { params: Promise<{ loanId: string }> }) => {
    const address = await requireMember()
    const { loanId: loanIdParam } = await context.params
    const loanId = Number(loanIdParam)
    const loan = Number.isInteger(loanId) ? getLoan(loanId) : undefined
    if (!loan) notFound('No such loan (has the indexer caught up?)')
    if (getAddress(loan.ownerAddress) !== address) forbidden('Only the owner signs return receipts')
    if (loan.status !== 'active') badRequest('That loan is already settled')

    const body = (await request.json()) as { returnedAt?: number; signature?: `0x${string}` }
    const returnedAt = Number(body.returnedAt)
    if (!body.signature) badRequest('signature required')
    if (!Number.isInteger(returnedAt)) badRequest('returnedAt required')
    if (returnedAt > now()) badRequest('Return time cannot be in the future')
    if (returnedAt < loan.startedAt) badRequest('Return time cannot be before the loan started')

    const valid = await publicClient.verifyTypedData({
      address,
      domain: eip712Domain,
      types: returnReceiptTypes,
      primaryType: 'ReturnReceipt',
      message: { loanId: BigInt(loanId), returnedAt: BigInt(returnedAt) },
      signature: body.signature,
    })
    if (!valid) badRequest('Signature does not match the receipt')

    saveReturnReceipt({ loanId, returnedAt, signature: body.signature })
    return NextResponse.json({ ok: true })
  },
)
