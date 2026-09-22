/**
 * EIP-712 payloads the owner signs. These must match ToolshedEscrow's typehashes exactly —
 * a mismatch shows up as a `BadSignature()` revert when the borrower tries to open the loan.
 */

import type {Address, Hex} from "viem";

export const EIP712_DOMAIN_NAME = "Toolshed";
export const EIP712_DOMAIN_VERSION = "1";

/** Terms the owner signs to approve a borrow request. */
export const TERMS_TYPES = {
  Terms: [
    {name: "owner", type: "address"},
    {name: "borrower", type: "address"},
    {name: "listingId", type: "bytes32"},
    {name: "deposit", type: "uint128"},
    {name: "dailyLateFee", type: "uint128"},
    {name: "dueAt", type: "uint64"},
    {name: "offerExpiry", type: "uint64"},
    {name: "salt", type: "uint256"},
  ],
} as const;

/** Return receipt the owner signs at handover, letting the borrower close the loan themselves. */
export const RECEIPT_TYPES = {
  Receipt: [
    {name: "loanId", type: "bytes32"},
    {name: "returnedAt", type: "uint64"},
  ],
} as const;

export interface Terms {
  owner: Address;
  borrower: Address;
  listingId: Hex;
  deposit: bigint;
  dailyLateFee: bigint;
  dueAt: bigint;
  offerExpiry: bigint;
  salt: bigint;
}

export function eip712Domain(chainId: number, verifyingContract: Address) {
  return {
    name: EIP712_DOMAIN_NAME,
    version: EIP712_DOMAIN_VERSION,
    chainId,
    verifyingContract,
  } as const;
}

/** JSON-safe form of Terms, for storing in SQLite and sending over the API. */
export type SerialisedTerms = Record<keyof Terms, string>;

export function serialiseTerms(terms: Terms): SerialisedTerms {
  return {
    owner: terms.owner,
    borrower: terms.borrower,
    listingId: terms.listingId,
    deposit: terms.deposit.toString(),
    dailyLateFee: terms.dailyLateFee.toString(),
    dueAt: terms.dueAt.toString(),
    offerExpiry: terms.offerExpiry.toString(),
    salt: terms.salt.toString(),
  };
}

export function deserialiseTerms(raw: SerialisedTerms): Terms {
  return {
    owner: raw.owner as Address,
    borrower: raw.borrower as Address,
    listingId: raw.listingId as Hex,
    deposit: BigInt(raw.deposit),
    dailyLateFee: BigInt(raw.dailyLateFee),
    dueAt: BigInt(raw.dueAt),
    offerExpiry: BigInt(raw.offerExpiry),
    salt: BigInt(raw.salt),
  };
}
