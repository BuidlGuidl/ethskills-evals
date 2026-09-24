import { config, isProduction } from './config.js';
import { db } from './db.js';
import { ensureSystemAccounts } from './payments/ledger.js';
import { escrow as loadEscrow } from './payments/escrow.js';
import { runDailyJob } from './jobs/daily.js';
import { startServer } from './web/server.js';

// One process: the web server plus an interval that does the daily
// housekeeping. At this size that is the whole deployment -- no queue, no
// worker, no cron container to keep in sync with the app. If the association
// ever outgrows it, `runDailyJob` is a pure function of (database, clock) and
// lifts straight out into a cron job.

const JOB_INTERVAL_MS = 6 * 60 * 60 * 1000;

const handle = db();
ensureSystemAccounts(handle);
const escrow = await loadEscrow();

const timer = setInterval(() => {
  try {
    const result = runDailyJob(handle, escrow);
    console.log('[job]', JSON.stringify(result));
  } catch (error) {
    console.error('[job] failed', error);
  }
}, JOB_INTERVAL_MS);
timer.unref();
runDailyJob(handle, escrow);

const server = await startServer({ handle, escrow });
console.log(
  `Toolshed listening on http://localhost:${config.port} ` +
    `(${isProduction ? 'production' : 'development'}, escrow=${escrow.name ?? config.escrowDriver}, db=${config.databasePath})`,
);

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    console.log(`\n${signal} — shutting down`);
    server.close(() => {
      handle.close();
      process.exit(0);
    });
  });
}
