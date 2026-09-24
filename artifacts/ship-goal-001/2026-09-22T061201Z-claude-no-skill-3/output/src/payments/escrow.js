import { config } from '../config.js';
import { nowIso } from '../domain/dates.js';
import { fromStorage, toStorage } from '../domain/money.js';
import { ESCROW, EXTERNAL, memberAccount, post, balanceOf, ensureSystemAccounts } from './ledger.js';

/**
 * The escrow port. Everything the lending flow needs to know about money is
 * these four calls, so the association can change how deposits are actually
 * custodied without touching the loan logic.
 *
 *   hold(handle, {loanId, memberId, amount})   deposit leaves the borrower
 *   release(handle, loanId)                    full deposit back to the borrower
 *   capture(handle, loanId, {fee, ownerId})    fee to the owner, rest back
 *   holdFor(handle, loanId)                    current state of a hold
 *
 * Two drivers ship: `ledger` (below) and `onchain` (see onchain.js).
 */

export class LedgerEscrow {
  constructor() {
    this.name = 'ledger';
  }

  hold(handle, { loanId, memberId, amount }) {
    ensureSystemAccounts(handle);
    if (amount < 0n) throw new Error('deposit cannot be negative');
    if (amount > 0n) {
      post(handle, {
        from: memberAccount(memberId),
        to: ESCROW,
        amount,
        kind: 'deposit_hold',
        loanId,
        memo: `deposit held for loan #${loanId}`,
      });
    }
    handle
      .prepare(
        `INSERT INTO escrow_holds (loan_id, member_id, amount, status, reference, created_at)
         VALUES (?, ?, ?, 'held', ?, ?)`,
      )
      .run(loanId, memberId, toStorage(amount), `ledger:${loanId}`, nowIso());
    return { reference: `ledger:${loanId}`, amount };
  }

  holdFor(handle, loanId) {
    const row = handle.prepare('SELECT * FROM escrow_holds WHERE loan_id = ?').get(loanId);
    return row ? { ...row, amount: fromStorage(row.amount) } : null;
  }

  release(handle, loanId) {
    const hold = this.#openHold(handle, loanId);
    if (hold.amount > 0n) {
      post(handle, {
        from: ESCROW,
        to: memberAccount(hold.member_id),
        amount: hold.amount,
        kind: 'deposit_release',
        loanId,
        memo: `deposit returned for loan #${loanId}`,
      });
    }
    this.#resolve(handle, loanId, 'released');
    return { refund: hold.amount, fee: 0n };
  }

  capture(handle, loanId, { fee, ownerId }) {
    const hold = this.#openHold(handle, loanId);
    if (fee < 0n || fee > hold.amount) throw new Error('late fee must be between zero and the deposit');
    if (fee > 0n) {
      post(handle, {
        from: ESCROW,
        to: memberAccount(ownerId),
        amount: fee,
        kind: 'late_fee',
        loanId,
        memo: `late fee for loan #${loanId}`,
      });
    }
    const refund = hold.amount - fee;
    if (refund > 0n) {
      post(handle, {
        from: ESCROW,
        to: memberAccount(hold.member_id),
        amount: refund,
        kind: 'deposit_release',
        loanId,
        memo: `deposit balance returned for loan #${loanId}`,
      });
    }
    this.#resolve(handle, loanId, fee > 0n ? 'captured' : 'released');
    return { refund, fee };
  }

  #openHold(handle, loanId) {
    const hold = this.holdFor(handle, loanId);
    if (!hold) throw new Error(`no escrow hold for loan #${loanId}`);
    if (hold.status !== 'held') throw new Error(`escrow hold for loan #${loanId} is already ${hold.status}`);
    return hold;
  }

  #resolve(handle, loanId, status) {
    handle
      .prepare('UPDATE escrow_holds SET status = ?, resolved_at = ? WHERE loan_id = ?')
      .run(status, nowIso(), loanId);
  }
}

/**
 * Funding and withdrawal. With the ledger driver these are the association
 * treasurer recording that USDC arrived in (or left) the association wallet;
 * with an on-chain driver they are a transfer and a payout.
 */
export function fund(handle, memberId, amount, memo = 'top up') {
  ensureSystemAccounts(handle);
  post(handle, { from: EXTERNAL, to: memberAccount(memberId), amount, kind: 'funding', memo });
}

export function withdraw(handle, memberId, amount, memo = 'withdrawal') {
  ensureSystemAccounts(handle);
  post(handle, { from: memberAccount(memberId), to: EXTERNAL, amount, kind: 'withdrawal', memo });
}

export function availableBalance(handle, memberId) {
  return balanceOf(handle, memberAccount(memberId));
}

let escrowInstance = null;

export async function escrow() {
  if (escrowInstance) return escrowInstance;
  if (config.escrowDriver === 'ledger') {
    escrowInstance = new LedgerEscrow();
  } else if (config.escrowDriver === 'onchain') {
    const { OnchainEscrow } = await import('./onchain.js');
    escrowInstance = new OnchainEscrow();
  } else {
    throw new Error(`Unknown TOOLSHED_ESCROW driver: ${config.escrowDriver}`);
  }
  return escrowInstance;
}

export function setEscrow(instance) {
  escrowInstance = instance;
}
