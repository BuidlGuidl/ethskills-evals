import type { Db } from './db/index.js';
import { config } from './config.js';
import { accrueAllDue, expireStaleRequests } from './domain/loans.js';
import { deleteExpiredSessions } from './domain/members.js';
import { formatUsdc } from './lib/money.js';

/**
 * Late fees are charged by a sweep rather than lazily on read, so the money
 * moves even if nobody opens the app. Everything it does is idempotent, so the
 * interval only controls how promptly fees land, never how much is charged.
 */
export function startMaintenanceWorker(db: Db): () => void {
  const intervalMs = Math.max(config.accrualIntervalMinutes, 1) * 60 * 1000;

  const run = () => {
    try {
      const accrual = accrueAllDue(db);
      const expired = expireStaleRequests(db);
      deleteExpiredSessions(db);
      if (accrual.loansCharged > 0 || expired > 0) {
        console.log(
          `[toolshed] maintenance: charged ${formatUsdc(accrual.microsCharged)} USDC in late fees ` +
            `across ${accrual.loansCharged} loan(s), expired ${expired} stale request(s)`,
        );
      }
    } catch (err) {
      // A failed sweep must not take the process down; the next one retries.
      console.error('[toolshed] maintenance sweep failed', err);
    }
  };

  run();
  const timer = setInterval(run, intervalMs);
  timer.unref();
  return () => clearInterval(timer);
}
