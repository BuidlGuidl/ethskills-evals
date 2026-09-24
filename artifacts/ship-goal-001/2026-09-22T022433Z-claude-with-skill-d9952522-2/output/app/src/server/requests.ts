import { getAddress, type Address } from 'viem'
import { db, now } from './db'
import { getTool, type Tool } from './tools'
import { compareReliability, trackRecord, type TrackRecord } from './reputation'
import type { SerializedLoanOffer } from '../chain/eip712'

export type RequestStatus = 'pending' | 'offered' | 'declined' | 'withdrawn' | 'started'

export type BorrowRequest = {
  id: number
  toolUuid: string
  borrowerAddress: Address
  days: number
  note: string
  status: RequestStatus
  loanId: number | null
  createdAt: number
  updatedAt: number
}

export type SignedOffer = {
  requestId: number
  terms: SerializedLoanOffer
  signature: `0x${string}`
  offerExpiry: number
  createdAt: number
}

/** A request with everything the owner's inbox needs to decide on it. */
export type RequestForOwner = BorrowRequest & {
  tool: Tool
  borrower: TrackRecord
  offer?: SignedOffer
}

type RequestRow = {
  id: number
  tool_uuid: string
  borrower_address: string
  days: number
  note: string
  status: string
  loan_id: number | null
  created_at: number
  updated_at: number
}

function toRequest(row: RequestRow): BorrowRequest {
  return {
    id: row.id,
    toolUuid: row.tool_uuid,
    borrowerAddress: row.borrower_address as Address,
    days: row.days,
    note: row.note,
    status: row.status as RequestStatus,
    loanId: row.loan_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function createRequest(input: {
  toolUuid: string
  borrowerAddress: Address
  days: number
  note: string
}): BorrowRequest {
  const timestamp = now()
  const result = db()
    .prepare(
      `INSERT INTO borrow_requests (tool_uuid, borrower_address, days, note, created_at, updated_at)
       VALUES (@toolUuid, @borrowerAddress, @days, @note, @createdAt, @createdAt)`,
    )
    .run({
      toolUuid: input.toolUuid,
      borrowerAddress: getAddress(input.borrowerAddress),
      days: input.days,
      note: input.note,
      createdAt: timestamp,
    })
  return getRequest(Number(result.lastInsertRowid))!
}

export function getRequest(id: number): BorrowRequest | undefined {
  const row = db().prepare<number, RequestRow>('SELECT * FROM borrow_requests WHERE id = ?').get(id)
  return row ? toRequest(row) : undefined
}

export function setRequestStatus(id: number, status: RequestStatus): void {
  db()
    .prepare('UPDATE borrow_requests SET status = ?, updated_at = ? WHERE id = ?')
    .run(status, now(), id)
}

export function hasOpenRequest(toolUuid: string, borrower: Address): boolean {
  const row = db()
    .prepare<[string, string], { n: number }>(
      `SELECT COUNT(*) AS n FROM borrow_requests
        WHERE tool_uuid = ? AND borrower_address = ? AND status IN ('pending', 'offered')`,
    )
    .get(toolUuid, getAddress(borrower))!
  return row.n > 0
}

export function saveOffer(input: {
  requestId: number
  terms: SerializedLoanOffer
  signature: string
}): void {
  const database = db()
  const transaction = database.transaction(() => {
    database
      .prepare(
        `INSERT INTO loan_offers (request_id, terms_json, signature, offer_expiry, nonce, created_at)
         VALUES (@requestId, @termsJson, @signature, @offerExpiry, @nonce, @createdAt)
         ON CONFLICT(request_id) DO UPDATE SET
           terms_json = @termsJson, signature = @signature,
           offer_expiry = @offerExpiry, nonce = @nonce, created_at = @createdAt`,
      )
      .run({
        requestId: input.requestId,
        termsJson: JSON.stringify(input.terms),
        signature: input.signature,
        offerExpiry: Number(input.terms.offerExpiry),
        nonce: input.terms.nonce,
        createdAt: now(),
      })
    database
      .prepare("UPDATE borrow_requests SET status = 'offered', updated_at = ? WHERE id = ?")
      .run(now(), input.requestId)
  })
  transaction()
}

export function getOffer(requestId: number): SignedOffer | undefined {
  const row = db()
    .prepare<
      number,
      {
        request_id: number
        terms_json: string
        signature: string
        offer_expiry: number
        created_at: number
      }
    >('SELECT * FROM loan_offers WHERE request_id = ?')
    .get(requestId)
  if (!row) return undefined
  return {
    requestId: row.request_id,
    terms: JSON.parse(row.terms_json) as SerializedLoanOffer,
    signature: row.signature as `0x${string}`,
    offerExpiry: row.offer_expiry,
    createdAt: row.created_at,
  }
}

/**
 * The owner's inbox, sorted so that the members with the best return record are
 * at the top: "the reliable people get lent to first".
 */
export function requestsForOwner(owner: Address): RequestForOwner[] {
  const rows = db()
    .prepare<string, RequestRow>(
      `SELECT r.* FROM borrow_requests r
         JOIN tools t ON t.uuid = r.tool_uuid
        WHERE t.owner_address = ? AND r.status IN ('pending', 'offered')
        ORDER BY r.created_at ASC`,
    )
    .all(getAddress(owner))

  return rows
    .map(toRequest)
    .map((request) => ({
      ...request,
      tool: getTool(request.toolUuid)!,
      borrower: trackRecord(request.borrowerAddress),
      offer: getOffer(request.id),
    }))
    .sort((a, b) => compareReliability(a.borrower, b.borrower) || a.createdAt - b.createdAt)
}

export function requestsByBorrower(borrower: Address): RequestForOwner[] {
  return db()
    .prepare<string, RequestRow>(
      `SELECT * FROM borrow_requests WHERE borrower_address = ?
        ORDER BY CASE status WHEN 'offered' THEN 0 WHEN 'pending' THEN 1 ELSE 2 END, created_at DESC`,
    )
    .all(getAddress(borrower))
    .map(toRequest)
    .map((request) => ({
      ...request,
      tool: getTool(request.toolUuid)!,
      borrower: trackRecord(request.borrowerAddress),
      offer: getOffer(request.id),
    }))
}

/** Requests waiting on this tool, best borrower first. */
export function openRequestsForTool(toolUuid: string): RequestForOwner[] {
  return db()
    .prepare<string, RequestRow>(
      `SELECT * FROM borrow_requests
        WHERE tool_uuid = ? AND status IN ('pending', 'offered') ORDER BY created_at ASC`,
    )
    .all(toolUuid)
    .map(toRequest)
    .map((request) => ({
      ...request,
      tool: getTool(request.toolUuid)!,
      borrower: trackRecord(request.borrowerAddress),
      offer: getOffer(request.id),
    }))
    .sort((a, b) => compareReliability(a.borrower, b.borrower) || a.createdAt - b.createdAt)
}
