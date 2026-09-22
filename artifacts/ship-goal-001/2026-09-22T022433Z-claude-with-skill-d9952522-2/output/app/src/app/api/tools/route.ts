import { NextResponse } from 'next/server'
import { parseUnits } from 'viem'
import { handler, badRequest } from '@/server/http'
import { requireMember, HttpError } from '@/server/session'
import { isOnRoster } from '@/server/chainClient'
import { createTool } from '@/server/tools'
import { savePhoto, PhotoError } from '@/server/storage'
import { USDC_DECIMALS } from '@/chain/config'

/** List a tool. Multipart, because a listing is mostly a photo. */
export const POST = handler(async (request: Request) => {
  const address = await requireMember()
  if (!(await isOnRoster(address))) {
    throw new HttpError(403, 'Only members on the association roster can list tools')
  }

  const form = await request.formData()
  const title = String(form.get('title') ?? '').trim()
  const conditionNotes = String(form.get('conditionNotes') ?? '').trim()
  const depositInput = String(form.get('deposit') ?? '').trim()
  const lateFeeInput = String(form.get('lateFeePerDay') ?? '').trim()
  const maxLoanDays = Number(form.get('maxLoanDays') ?? 7)
  const photo = form.get('photo')

  if (!title) badRequest('What is it?')
  if (title.length > 80) badRequest('Keep the title under 80 characters')
  if (conditionNotes.length > 1000) badRequest('Condition notes are too long')
  if (!Number.isInteger(maxLoanDays) || maxLoanDays < 1 || maxLoanDays > 90) {
    badRequest('Loan length must be between 1 and 90 days')
  }

  let deposit: bigint
  let lateFeePerDay: bigint
  try {
    deposit = parseUnits(depositInput, USDC_DECIMALS)
    lateFeePerDay = parseUnits(lateFeeInput, USDC_DECIMALS)
  } catch {
    return badRequest('Deposit and late fee must be USDC amounts, e.g. 40 or 2.50')
  }
  if (deposit <= 0n) badRequest('Set a deposit')
  if (lateFeePerDay <= 0n) badRequest('Set a daily late fee')
  if (lateFeePerDay > deposit) badRequest('A single late day cannot cost more than the deposit')

  // The contract requires lateFeePerDay * maxLateDays <= deposit, so the cap is
  // simply how many whole late days the deposit can pay for.
  const maxLateDays = Number(deposit / lateFeePerDay)

  let photoKey: string | null = null
  if (photo instanceof File && photo.size > 0) {
    try {
      photoKey = await savePhoto(photo)
    } catch (error) {
      if (error instanceof PhotoError) badRequest(error.message)
      throw error
    }
  }

  const tool = createTool({
    ownerAddress: address,
    title,
    conditionNotes,
    photoKey,
    deposit,
    lateFeePerDay,
    maxLateDays,
    maxLoanDays,
  })

  return NextResponse.json({ uuid: tool.uuid, toolId: tool.toolId, maxLateDays })
})
