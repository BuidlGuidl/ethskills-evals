import type { Db } from '../db/index.js';
import { tx } from '../db/index.js';
import { ApiError } from '../lib/errors.js';
import { newId } from '../lib/ids.js';
import { formatUsdc } from '../lib/money.js';

export type Account = 'available' | 'escrow' | 'external';

export type TransferKind =
  | 'top_up'           // outside world -> member's available balance
  | 'withdrawal'       // member's available balance -> outside world
  | 'deposit_hold'     // borrower available -> borrower escrow (loan requested)
  | 'deposit_release'  // borrower escrow -> borrower available (loan settled/cancelled)
  | 'late_fee';        // borrower escrow -> owner available

export interface Leg {
  memberId: string | null;
  account: Account;
  amount: number; // signed micro-USDC
}

export interface PostTransfer {
  kind: TransferKind;
  legs: Leg[];
  /** Same key posted twice is a no-op, which makes every caller safely retryable. */
  idempotencyKey: string;
  loanId?: string | null;
  memo?: string;
  at?: number;
}

export interface Balances {
  available: number;
  escrow: number;
}

export interface LedgerRow {
  id: number;
  transferId: string;
  kind: TransferKind;
  account: Account;
  amount: number;
  memo: string;
  loanId: string | null;
  createdAt: number;
}

export interface PostResult {
  transferId: string | null;
  posted: boolean;
}

export function postTransfer(db: Db, input: PostTransfer): PostResult {
  const legs = input.legs.filter((l) => l.amount !== 0);
  if (legs.length === 0) throw new Error('transfer has no non-zero legs');
  const sum = legs.reduce((acc, l) => acc + l.amount, 0);
  if (sum !== 0) throw new Error(`unbalanced transfer (${input.kind}): legs sum to ${sum}`);

  return tx(db, () => {
    const existing = db
      .prepare('SELECT id FROM transfers WHERE idempotency_key = ?')
      .get(input.idempotencyKey) as { id: string } | undefined;
    if (existing) return { transferId: existing.id, posted: false };

    const at = input.at ?? Date.now();
    const transferId = newId('tr');
    db.prepare(
      `INSERT INTO transfers (id, kind, loan_id, memo, idempotency_key, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(transferId, input.kind, input.loanId ?? null, input.memo ?? '', input.idempotencyKey, at);

    const insertEntry = db.prepare(
      `INSERT INTO ledger_entries (transfer_id, member_id, account, amount, loan_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    );
    for (const leg of legs) {
      insertEntry.run(transferId, leg.memberId, leg.account, leg.amount, input.loanId ?? null, at);
    }

    // Balances are derived, so the only place to enforce "no overdrafts" is here.
    for (const leg of legs) {
      if (leg.amount >= 0 || leg.account === 'external' || leg.memberId === null) continue;
      const balance = accountBalance(db, leg.memberId, leg.account);
      if (balance < 0) {
        throw ApiError.conflict(
          'insufficient_funds',
          `Not enough USDC in ${leg.account} (short by ${formatUsdc(-balance)} USDC)`,
          { account: leg.account, shortfallMicros: -balance },
        );
      }
      // A member's escrow is the sum of per-loan holds; one loan must never be
      // able to spend another loan's deposit.
      if (leg.account === 'escrow' && input.loanId) {
        const perLoan = loanEscrowBalance(db, input.loanId);
        if (perLoan < 0) {
          throw ApiError.conflict(
            'insufficient_escrow',
            `Loan deposit is exhausted (short by ${formatUsdc(-perLoan)} USDC)`,
            { loanId: input.loanId, shortfallMicros: -perLoan },
          );
        }
      }
    }

    return { transferId, posted: true };
  });
}

export function accountBalance(db: Db, memberId: string, account: Account): number {
  const row = db
    .prepare(
      `SELECT COALESCE(SUM(amount), 0) AS total FROM ledger_entries
       WHERE member_id = ? AND account = ?`,
    )
    .get(memberId, account) as { total: number };
  return row.total;
}

export function balances(db: Db, memberId: string): Balances {
  return {
    available: accountBalance(db, memberId, 'available'),
    escrow: accountBalance(db, memberId, 'escrow'),
  };
}

/** How much of a loan's deposit is still sitting in escrow. */
export function loanEscrowBalance(db: Db, loanId: string): number {
  const row = db
    .prepare(
      `SELECT COALESCE(SUM(amount), 0) AS total FROM ledger_entries
       WHERE loan_id = ? AND account = 'escrow'`,
    )
    .get(loanId) as { total: number };
  return row.total;
}

export function history(db: Db, memberId: string, limit = 100): LedgerRow[] {
  return db
    .prepare(
      `SELECT e.id, e.transfer_id AS transferId, t.kind, e.account, e.amount, t.memo,
              e.loan_id AS loanId, e.created_at AS createdAt
         FROM ledger_entries e
         JOIN transfers t ON t.id = e.transfer_id
        WHERE e.member_id = ?
        ORDER BY e.id DESC
        LIMIT ?`,
    )
    .all(memberId, limit) as LedgerRow[];
}

// --- named transfers -------------------------------------------------------

export function topUp(db: Db, memberId: string, micros: number, ref: string, at?: number) {
  return postTransfer(db, {
    kind: 'top_up',
    idempotencyKey: `top_up:${ref}`,
    memo: 'USDC top-up',
    at,
    legs: [
      { memberId: null, account: 'external', amount: -micros },
      { memberId, account: 'available', amount: micros },
    ],
  });
}

export function withdraw(db: Db, memberId: string, micros: number, ref: string, at?: number) {
  return postTransfer(db, {
    kind: 'withdrawal',
    idempotencyKey: `withdrawal:${ref}`,
    memo: 'USDC withdrawal',
    at,
    legs: [
      { memberId, account: 'available', amount: -micros },
      { memberId: null, account: 'external', amount: micros },
    ],
  });
}

/** A zero deposit (a tool lent for free) is a no-op, not an empty transfer. */
export function holdDeposit(db: Db, loanId: string, borrowerId: string, micros: number, at?: number): PostResult {
  if (micros <= 0) return { transferId: null, posted: false };
  return postTransfer(db, {
    kind: 'deposit_hold',
    idempotencyKey: `deposit_hold:${loanId}`,
    loanId,
    memo: 'Deposit held for loan',
    at,
    legs: [
      { memberId: borrowerId, account: 'available', amount: -micros },
      { memberId: borrowerId, account: 'escrow', amount: micros },
    ],
  });
}

export function releaseDeposit(
  db: Db,
  loanId: string,
  borrowerId: string,
  micros: number,
  reason: 'settled' | 'cancelled' | 'declined',
  at?: number,
): PostResult {
  if (micros <= 0) return { transferId: null, posted: false };
  return postTransfer(db, {
    kind: 'deposit_release',
    idempotencyKey: `deposit_release:${loanId}`,
    loanId,
    memo: `Deposit returned (${reason})`,
    at,
    legs: [
      { memberId: borrowerId, account: 'escrow', amount: -micros },
      { memberId: borrowerId, account: 'available', amount: micros },
    ],
  });
}

/**
 * Late fees move straight from the borrower's escrowed deposit to the owner.
 * `day` is the late-day counter the charge covers, which keeps the accrual
 * worker idempotent no matter how often it runs.
 */
export function chargeLateFee(
  db: Db,
  loanId: string,
  borrowerId: string,
  ownerId: string,
  micros: number,
  day: number,
  at?: number,
): PostResult {
  if (micros <= 0) return { transferId: null, posted: false };
  return postTransfer(db, {
    kind: 'late_fee',
    idempotencyKey: `late_fee:${loanId}:${day}`,
    loanId,
    memo: `Late fee, day ${day}`,
    at,
    legs: [
      { memberId: borrowerId, account: 'escrow', amount: -micros },
      { memberId: ownerId, account: 'available', amount: micros },
    ],
  });
}
