import { config } from './config.js';
import { openDb } from './db/index.js';
import { createApp } from './http/app.js';
import { LocalPhotoStore } from './lib/photos.js';
import { createPaymentProvider } from './payments/index.js';
import { startMaintenanceWorker } from './worker.js';

const db = openDb(config.databaseUrl);
const app = createApp({
  db,
  payments: createPaymentProvider(),
  photos: new LocalPhotoStore(config.uploadDir),
});

const stopWorker = config.runAccrualWorker ? startMaintenanceWorker(db) : () => {};

const server = app.listen(config.port, () => {
  console.log(
    `[toolshed] listening on :${config.port} (${config.nodeEnv}, payments=${config.paymentProvider}, db=${config.databaseUrl})`,
  );
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    console.log(`[toolshed] ${signal} received, shutting down`);
    stopWorker();
    server.close(() => {
      db.close();
      process.exit(0);
    });
  });
}
