import { daysBetween } from './dates.js';
import { min } from './money.js';

// The deposit is the only money in the system, so it is also the ceiling on
// what an owner can collect. A tool that is 40 days late does not generate an
// unbounded debt -- the owner keeps the whole deposit and the loan is closed
// as "deposit forfeited". Anything beyond that is a conversation between
// neighbours, not something this app tries to enforce.

/**
 * Whole days a loan is late.
 * @param {string} dueDay    'YYYY-MM-DD', the last day the borrower may keep it
 * @param {string} asOfDay   the day the tool came back (or today, for a loan still out)
 */
export function lateDays(dueDay, asOfDay) {
  return Math.max(0, daysBetween(dueDay, asOfDay));
}

/**
 * Split a deposit into the owner's late fee and the borrower's refund.
 * @param {bigint} deposit       micro-USDC held in escrow
 * @param {bigint} dailyLateFee  micro-USDC per late day
 * @param {number} days          whole late days
 */
export function settle(deposit, dailyLateFee, days) {
  if (days < 0 || !Number.isInteger(days)) throw new Error('late days must be a non-negative integer');
  const accrued = dailyLateFee * BigInt(days);
  const fee = min(accrued, deposit);
  return {
    lateDays: days,
    accrued,
    fee,
    refund: deposit - fee,
    forfeited: accrued >= deposit && deposit > 0n,
  };
}

/** What the borrower stands to lose if a loan that is still out came back today. */
export function projectedSettlement(loan, asOfDay) {
  return settle(loan.depositAmount, loan.dailyLateFee, lateDays(loan.dueDay, asOfDay));
}
