import { keccak256, stringToHex, type Address, type Hex } from 'viem'
import { chainId, toolshedAddress } from './config'

/**
 * The two things a tool owner signs offchain. Both are verified inside the
 * contract, so these type definitions have to match `Toolshed.sol` exactly —
 * field order included.
 */

export const eip712Domain = {
  name: 'Toolshed',
  version: '1',
  chainId,
  verifyingContract: toolshedAddress,
} as const

export const loanOfferTypes = {
  LoanOffer: [
    { name: 'toolId', type: 'bytes32' },
    { name: 'owner', type: 'address' },
    { name: 'borrower', type: 'address' },
    { name: 'deposit', type: 'uint256' },
    { name: 'lateFeePerDay', type: 'uint256' },
    { name: 'dueAt', type: 'uint64' },
    { name: 'maxLateDays', type: 'uint32' },
    { name: 'offerExpiry', type: 'uint64' },
    { name: 'nonce', type: 'uint256' },
  ],
} as const

export const returnReceiptTypes = {
  ReturnReceipt: [
    { name: 'loanId', type: 'uint256' },
    { name: 'returnedAt', type: 'uint64' },
  ],
} as const

/** Loan terms, as they are signed, stored offchain and finally submitted onchain. */
export type LoanOffer = {
  toolId: Hex
  owner: Address
  borrower: Address
  deposit: bigint
  lateFeePerDay: bigint
  dueAt: bigint
  maxLateDays: number
  offerExpiry: bigint
  nonce: bigint
}

/** JSON-safe form used by the HTTP API and the database. */
export type SerializedLoanOffer = {
  toolId: Hex
  owner: Address
  borrower: Address
  deposit: string
  lateFeePerDay: string
  dueAt: string
  maxLateDays: number
  offerExpiry: string
  nonce: string
}

export function serializeOffer(offer: LoanOffer): SerializedLoanOffer {
  return {
    ...offer,
    deposit: offer.deposit.toString(),
    lateFeePerDay: offer.lateFeePerDay.toString(),
    dueAt: offer.dueAt.toString(),
    offerExpiry: offer.offerExpiry.toString(),
    nonce: offer.nonce.toString(),
  }
}

export function deserializeOffer(offer: SerializedLoanOffer): LoanOffer {
  return {
    ...offer,
    deposit: BigInt(offer.deposit),
    lateFeePerDay: BigInt(offer.lateFeePerDay),
    dueAt: BigInt(offer.dueAt),
    offerExpiry: BigInt(offer.offerExpiry),
    nonce: BigInt(offer.nonce),
  }
}

/**
 * The onchain handle for an offchain listing. The contract only ever sees this
 * hash; the photo, title and condition notes stay in the app's database.
 */
export function toolIdFor(listingUuid: string): Hex {
  return keccak256(stringToHex(`toolshed:listing:${listingUuid}`))
}
