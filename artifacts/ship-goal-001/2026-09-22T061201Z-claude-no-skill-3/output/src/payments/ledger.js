import { fromStorage, toStorage } from '../domain/money.js';
import { nowIso } from '../domain/dates.js';

// Double-entry ledger in micro-USDC. Every movement of money is a row in
// ledger_entries with a source and a destination account, and account balances
// are derived from those rows. Nothing debits an account without crediting
// another one, so `SELECT sum()` over the whole ledger is always zero and a
// missing refund is findable rather than merely suspected.
//
// Accounts:
//   member:<id>  a member's Toolshed balance
//   escrow       deposits held against open loans
//   external     the world outside Toolshed (the association's USDC wallet).
//                Money entering the system comes from here; withdrawals go
//                back to it. It is expected to run negative.

export const ESCROW = 'escrow';
export const EXTERNAL = 'external';

export function memberAccount(memberId) {
  return `member:${memberId}`;
}

export function ensureAccount(handle, id, kind = 'member') {
  handle
    .prepare('INSERT OR IGNORE INTO ledger_accounts (id, kind, balance) VALUES (?, ?, ?)')
    .run(id, kind, '0');
  return id;
}

export function ensureSystemAccounts(handle) {
  ensureAccount(handle, ESCROW, 'system');
  ensureAccount(handle, EXTERNAL, 'system');
}

export function balanceOf(handle, accountId) {
  const row = handle.prepare('SELECT balance FROM ledger_accounts WHERE id = ?').get(accountId);
  return row ? fromStorage(row.balance) : 0n;
}

/**
 * Move `amount` from one account to another. Caller is responsible for the
 * surrounding transaction.
 * @param {{from:string,to:string,amount:bigint,kind:string,loanId?:number,memo?:string}} entry
 */
export function post(handle, { from, to, amount, kind, loanId = null, memo = '' }) {
  if (typeof amount !== 'bigint') throw new TypeError('amount must be a bigint of micro-USDC');
  if (amount <= 0n) throw new Error('ledger entries must move a positive amount');
  if (from === to) throw new Error('ledger entry must have two different accounts');
  ensureAccount(handle, from);
  ensureAccount(handle, to);

  // Member accounts may not go negative -- that would be Toolshed extending
  // credit, which it does not do. System accounts are allowed to.
  const fromRow = handle.prepare('SELECT kind, balance FROM ledger_accounts WHERE id = ?').get(from);
  const nextFrom = fromStorage(fromRow.balance) - amount;
  if (fromRow.kind === 'member' && nextFrom < 0n) {
    const error = new Error('Not enough USDC in that account');
    error.code = 'INSUFFICIENT_FUNDS';
    throw error;
  }

  handle
    .prepare('UPDATE ledger_accounts SET balance = ? WHERE id = ?')
    .run(toStorage(nextFrom), from);
  handle
    .prepare('UPDATE ledger_accounts SET balance = ? WHERE id = ?')
    .run(toStorage(balanceOf(handle, to) + amount), to);
  handle
    .prepare(
      `INSERT INTO ledger_entries (from_account, to_account, amount, kind, loan_id, memo, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(from, to, toStorage(amount), kind, loanId, memo, nowIso());
}

export function entriesFor(handle, accountId, limit = 50) {
  return handle
    .prepare(
      `SELECT * FROM ledger_entries
        WHERE from_account = ? OR to_account = ?
        ORDER BY id DESC LIMIT ?`,
    )
    .all(accountId, accountId, limit);
}

/** Sum of every account. Always 0 if the ledger is intact. */
export function ledgerTotal(handle) {
  return handle
    .prepare('SELECT balance FROM ledger_accounts')
    .all()
    .reduce((sum, row) => sum + fromStorage(row.balance), 0n);
}
