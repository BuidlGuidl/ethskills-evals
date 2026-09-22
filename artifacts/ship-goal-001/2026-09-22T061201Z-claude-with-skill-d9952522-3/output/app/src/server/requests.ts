import crypto from "node:crypto";

import {db, normaliseAddress, now} from "./db.ts";
import {allTrackRecords} from "./members.ts";
import {getListing} from "./listings.ts";
import {deserialiseTerms, type SerialisedTerms} from "@/core/eip712.ts";
import {emptyRecord, reliabilityScore, type TrackRecord} from "@/core/reputation.ts";

export interface BorrowRequest {
  id: string;
  listingId: string;
  listingTitle: string;
  borrowerAddress: string;
  borrowerName: string;
  message: string;
  days: number;
  status: "pending" | "approved" | "declined" | "opened" | "withdrawn";
  terms: SerialisedTerms | null;
  ownerSignature: string | null;
  loanId: string | null;
  offerExpiry: number | null;
  createdAt: number;
}

/** A request as the owner sees it in their queue, with the requester's track record attached. */
export interface RankedRequest extends BorrowRequest {
  borrowerRecord: TrackRecord;
}

interface RequestRow {
  id: string;
  listing_id: string;
  listing_title: string;
  borrower_address: string;
  borrower_name: string;
  message: string;
  days: number;
  status: BorrowRequest["status"];
  terms_json: string | null;
  owner_signature: string | null;
  loan_id: string | null;
  offer_expiry: number | null;
  created_at: number;
}

const SELECT = `
  SELECT r.*, l.title AS listing_title, m.display_name AS borrower_name
    FROM requests r
    JOIN listings l ON l.id = r.listing_id
    JOIN members m ON m.address = r.borrower_address`;

const toRequest = (row: RequestRow): BorrowRequest => ({
  id: row.id,
  listingId: row.listing_id,
  listingTitle: row.listing_title,
  borrowerAddress: row.borrower_address,
  borrowerName: row.borrower_name,
  message: row.message,
  days: row.days,
  status: row.status,
  terms: row.terms_json ? (JSON.parse(row.terms_json) as SerialisedTerms) : null,
  ownerSignature: row.owner_signature,
  loanId: row.loan_id,
  offerExpiry: row.offer_expiry,
  createdAt: row.created_at,
});

export function createRequest(input: {
  listingId: string;
  borrowerAddress: string;
  message: string;
  days: number;
}): BorrowRequest {
  const id = crypto.randomUUID();
  const timestamp = now();
  db()
    .prepare(
      `INSERT INTO requests (id, listing_id, borrower_address, message, days, status,
                             created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)`,
    )
    .run(id, input.listingId, normaliseAddress(input.borrowerAddress), input.message, input.days, timestamp, timestamp);
  return getRequest(id)!;
}

export function getRequest(id: string): BorrowRequest | null {
  const row = db().prepare(`${SELECT} WHERE r.id = ?`).get(id) as RequestRow | undefined;
  return row ? toRequest(row) : null;
}

/**
 * Records the owner's approval: the exact terms they signed, plus the signature.
 *
 * `loanId` is the EIP-712 digest the contract will assign, computed by the client when it signs.
 * Storing it here is what lets the indexer tie a `LoanOpened` event back to this request without
 * scanning, and what stops the same approval being recorded twice.
 */
export function approveRequest(input: {
  requestId: string;
  terms: SerialisedTerms;
  signature: string;
  loanId: string;
}): void {
  const terms = deserialiseTerms(input.terms);
  db()
    .prepare(
      `UPDATE requests
          SET status = 'approved', terms_json = ?, owner_signature = ?, loan_id = ?,
              offer_expiry = ?, updated_at = ?
        WHERE id = ? AND status = 'pending'`,
    )
    .run(
      JSON.stringify(input.terms),
      input.signature,
      input.loanId,
      Number(terms.offerExpiry),
      now(),
      input.requestId,
    );
}

export function setRequestStatus(id: string, status: BorrowRequest["status"]): void {
  db()
    .prepare("UPDATE requests SET status = ?, updated_at = ? WHERE id = ?")
    .run(status, now(), id);
}

/** Marks the approval as used. Called by the indexer when the matching LoanOpened arrives. */
export function markRequestOpened(loanId: string): void {
  db()
    .prepare("UPDATE requests SET status = 'opened', updated_at = ? WHERE loan_id = ?")
    .run(now(), loanId);
}

export function requestsByBorrower(address: string): BorrowRequest[] {
  const rows = db()
    .prepare(`${SELECT} WHERE r.borrower_address = ? ORDER BY r.created_at DESC`)
    .all(normaliseAddress(address)) as RequestRow[];
  return rows.map(toRequest);
}

/**
 * An owner's incoming queue, best-regarded requester first.
 *
 * This is the other half of "reliable people get lent to first": the browse screen ranks tools by
 * their owner, and this ranks would-be borrowers by theirs. An owner with one drill and four
 * people asking for it sees the person who brings things back at the top of the list.
 */
export function pendingRequestsForOwner(address: string): RankedRequest[] {
  const rows = db()
    .prepare(
      `${SELECT} WHERE l.owner_address = ? AND r.status IN ('pending', 'approved')
        ORDER BY r.created_at ASC`,
    )
    .all(normaliseAddress(address)) as RequestRow[];

  const records = allTrackRecords();
  return rows
    .map((row) => {
      const request = toRequest(row);
      return {
        ...request,
        borrowerRecord:
          records.get(request.borrowerAddress) ??
          emptyRecord(request.borrowerAddress, request.borrowerName),
      };
    })
    .sort((a, b) => {
      // Approved-but-not-yet-collected sink below anything still needing a decision.
      const aPending = a.status === "pending" ? 0 : 1;
      const bPending = b.status === "pending" ? 0 : 1;
      if (aPending !== bPending) return aPending - bPending;
      const diff = reliabilityScore(b.borrowerRecord) - reliabilityScore(a.borrowerRecord);
      if (Math.abs(diff) > 1e-9) return diff;
      return a.createdAt - b.createdAt;
    });
}

/** Requests still open against a listing, used to stop an owner double-approving one tool. */
export function activeApprovalsForListing(listingId: string): BorrowRequest[] {
  const rows = db()
    .prepare(`${SELECT} WHERE r.listing_id = ? AND r.status = 'approved' AND r.offer_expiry > ?`)
    .all(listingId, now()) as RequestRow[];
  return rows.map(toRequest);
}

export function listingForRequest(requestId: string) {
  const request = getRequest(requestId);
  return request ? getListing(request.listingId) : null;
}
