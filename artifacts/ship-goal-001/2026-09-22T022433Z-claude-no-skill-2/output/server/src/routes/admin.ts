import { Router } from 'express';
import { requireAdmin } from '../http/context.js';
import { accrueAllDue, expireStaleRequests } from '../domain/loans.js';
import { deleteExpiredSessions } from '../domain/members.js';
import { money } from '../http/serialize.js';

export function adminRoutes(): Router {
  const router = Router();

  /**
   * Runs the same maintenance the background worker does. Useful for cron-only
   * deployments (scale the worker to zero and hit this from a scheduler) and
   * for reproducing late-fee behaviour in tests.
   */
  router.post('/run-maintenance', (req, res) => {
    requireAdmin(req);
    const accrual = accrueAllDue(req.ctx.db);
    const expiredRequests = expireStaleRequests(req.ctx.db);
    const expiredSessions = deleteExpiredSessions(req.ctx.db);
    res.json({
      accrual: { ...accrual, charged: money(accrual.microsCharged) },
      expiredRequests,
      expiredSessions,
    });
  });

  /** Ledger invariants. If any of these are non-zero, stop and investigate. */
  router.get('/ledger-check', (req, res) => {
    requireAdmin(req);
    const db = req.ctx.db;
    const unbalanced = db
      .prepare(
        `SELECT transfer_id, SUM(amount) AS total FROM ledger_entries
          GROUP BY transfer_id HAVING total != 0`,
      )
      .all() as { transfer_id: string; total: number }[];
    const negative = db
      .prepare(
        `SELECT member_id, account, SUM(amount) AS total FROM ledger_entries
          WHERE member_id IS NOT NULL GROUP BY member_id, account HAVING total < 0`,
      )
      .all() as { member_id: string; account: string; total: number }[];
    const escrowVsLoans = db
      .prepare(
        `SELECT l.id AS loan_id, COALESCE(SUM(e.amount), 0) AS escrow
           FROM loans l LEFT JOIN ledger_entries e ON e.loan_id = l.id AND e.account = 'escrow'
          WHERE l.status IN ('returned', 'declined', 'cancelled')
          GROUP BY l.id HAVING escrow != 0`,
      )
      .all() as { loan_id: string; escrow: number }[];
    res.json({ ok: !unbalanced.length && !negative.length && !escrowVsLoans.length, unbalanced, negative, escrowVsLoans });
  });

  return router;
}
