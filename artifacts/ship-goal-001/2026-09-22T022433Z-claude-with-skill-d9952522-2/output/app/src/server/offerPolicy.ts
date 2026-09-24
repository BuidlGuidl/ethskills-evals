import { randomBytes } from 'node:crypto'
import { getAddress, type Address } from 'viem'
import { publicClient, toolshed } from './chainClient'
import { now } from './db'
import { HttpError } from './session'
import {
  eip712Domain,
  loanOfferTypes,
  type LoanOffer,
  type SerializedLoanOffer,
} from '../chain/eip712'
import type { Tool } from './tools'
import type { BorrowRequest } from './requests'

/**
 * Loan terms are prepared by the server and signed by the owner's wallet, then
 * checked again on the way back in. The contract enforces the money rules; this
 * module enforces the house rules — you can only offer your own tool, to the
 * member who actually asked for it, on the terms your listing advertises.
 */

const OFFER_VALID_FOR = 3 * 86_400 // an owner's signature is good for three days
const MIN_LOAN_SECONDS = 3_600

export function prepareTerms(input: {
  tool: Tool
  request: BorrowRequest
  owner: Address
}): LoanOffer {
  const timestamp = now()
  return {
    toolId: input.tool.toolId,
    owner: getAddress(input.owner),
    borrower: getAddress(input.request.borrowerAddress),
    deposit: input.tool.deposit,
    lateFeePerDay: input.tool.lateFeePerDay,
    dueAt: BigInt(timestamp + input.request.days * 86_400),
    maxLateDays: input.tool.maxLateDays,
    offerExpiry: BigInt(timestamp + OFFER_VALID_FOR),
    nonce: BigInt(`0x${randomBytes(12).toString('hex')}`),
  }
}

export function offerTypedData(offer: LoanOffer) {
  return {
    domain: eip712Domain,
    types: loanOfferTypes,
    primaryType: 'LoanOffer' as const,
    message: offer,
  }
}

function fail(message: string): never {
  throw new HttpError(400, message)
}

/**
 * Validates an owner-signed offer before we store it and hand it to a borrower,
 * so a borrower never wastes gas on terms the contract would reject.
 */
export async function validateSignedOffer(input: {
  terms: SerializedLoanOffer
  signature: `0x${string}`
  tool: Tool
  request: BorrowRequest
  owner: Address
}): Promise<void> {
  const { terms, tool, request } = input
  const timestamp = now()

  if (getAddress(terms.owner) !== getAddress(input.owner)) fail('Offer must be signed by the tool owner')
  if (getAddress(terms.borrower) !== getAddress(request.borrowerAddress)) {
    fail('Offer must name the member who made the request')
  }
  if (terms.toolId !== tool.toolId) fail('Offer is for a different tool')
  if (BigInt(terms.deposit) !== tool.deposit) fail('Deposit must match the listing')
  if (BigInt(terms.lateFeePerDay) !== tool.lateFeePerDay) fail('Late fee must match the listing')
  if (terms.maxLateDays !== tool.maxLateDays) fail('Late fee cap must match the listing')
  if (BigInt(terms.lateFeePerDay) * BigInt(terms.maxLateDays) > BigInt(terms.deposit)) {
    fail('Capped late fee cannot exceed the deposit')
  }

  const dueAt = Number(terms.dueAt)
  if (dueAt < timestamp + MIN_LOAN_SECONDS) fail('Due date is too soon')
  // One extra day of slack: the borrower may fund the deposit a little later than
  // the owner signed, and the owner set the clock running from signing time.
  if (dueAt > timestamp + (request.days + 1) * 86_400) fail('Due date is later than the request asked for')

  const offerExpiry = Number(terms.offerExpiry)
  if (offerExpiry <= timestamp) fail('Offer has already expired')
  if (offerExpiry > timestamp + OFFER_VALID_FOR + 60) fail('Offer expiry is too far out')

  const nonceUsed = await publicClient.readContract({
    ...toolshed,
    functionName: 'offerNonceUsed',
    args: [getAddress(terms.owner), BigInt(terms.nonce)],
  })
  if (nonceUsed) fail('Offer nonce has already been used onchain')

  const activeLoan = await publicClient.readContract({
    ...toolshed,
    functionName: 'activeLoanOf',
    args: [tool.toolId],
  })
  if (activeLoan !== 0n) fail('That tool is already out on loan')

  const valid = await publicClient.verifyTypedData({
    address: getAddress(terms.owner),
    signature: input.signature,
    ...offerTypedData({
      ...terms,
      deposit: BigInt(terms.deposit),
      lateFeePerDay: BigInt(terms.lateFeePerDay),
      dueAt: BigInt(terms.dueAt),
      offerExpiry: BigInt(terms.offerExpiry),
      nonce: BigInt(terms.nonce),
    }),
  })
  if (!valid) fail('Signature does not match the terms')
}
