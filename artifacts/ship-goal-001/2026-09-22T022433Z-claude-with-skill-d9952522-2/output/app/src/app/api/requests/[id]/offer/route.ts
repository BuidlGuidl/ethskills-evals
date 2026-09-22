import { NextResponse } from 'next/server'
import { getAddress } from 'viem'
import { handler, badRequest, forbidden, notFound } from '@/server/http'
import { requireMember } from '@/server/session'
import { getRequest, saveOffer } from '@/server/requests'
import { getTool } from '@/server/tools'
import { offerTypedData, prepareTerms, validateSignedOffer } from '@/server/offerPolicy'
import { deserializeOffer, serializeOffer, type SerializedLoanOffer } from '@/chain/eip712'

async function loadOwned(idParam: string, owner: string) {
  const id = Number(idParam)
  const request = Number.isInteger(id) ? getRequest(id) : undefined
  if (!request) notFound('No such request')
  const tool = getTool(request.toolUuid)
  if (!tool) notFound('No such tool')
  if (getAddress(tool.ownerAddress) !== getAddress(owner)) forbidden('That is not your tool')
  return { request, tool }
}

/**
 * The exact terms the owner should sign. Computed server-side from the listing
 * and the request so the two sides cannot drift apart.
 */
export const GET = handler(async (_req: Request, context: { params: Promise<{ id: string }> }) => {
  const address = await requireMember()
  const { id } = await context.params
  const { request, tool } = await loadOwned(id, address)
  if (request.status === 'started') badRequest('That loan has already started')

  const terms = prepareTerms({ tool, request, owner: address })
  const typedData = offerTypedData(terms)
  return NextResponse.json({
    terms: serializeOffer(terms),
    domain: typedData.domain,
    types: typedData.types,
    primaryType: typedData.primaryType,
  })
})

/** Store the owner's signed offer so the borrower can fund it. */
export const POST = handler(
  async (httpRequest: Request, context: { params: Promise<{ id: string }> }) => {
    const address = await requireMember()
    const { id } = await context.params
    const { request, tool } = await loadOwned(id, address)
    if (request.status === 'started') badRequest('That loan has already started')

    const body = (await httpRequest.json()) as {
      terms?: SerializedLoanOffer
      signature?: `0x${string}`
    }
    if (!body.terms || !body.signature) badRequest('terms and signature required')

    await validateSignedOffer({
      terms: body.terms,
      signature: body.signature,
      tool,
      request,
      owner: address,
    })

    saveOffer({ requestId: request.id, terms: body.terms, signature: body.signature })
    // Round-trip through the parser so a malformed stored offer fails here, not
    // in the borrower's wallet.
    deserializeOffer(body.terms)
    return NextResponse.json({ ok: true })
  },
)
