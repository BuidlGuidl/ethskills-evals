import express, { type Express } from 'express';
import cookieParser from 'cookie-parser';
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import type { AppContext } from './context.js';
import { errorHandler, loadSession, notFound } from './middleware.js';
import { authRoutes } from '../routes/auth.js';
import { toolRoutes } from '../routes/tools.js';
import { loanRoutes } from '../routes/loans.js';
import { memberRoutes } from '../routes/members.js';
import { walletRoutes } from '../routes/wallet.js';
import { adminRoutes } from '../routes/admin.js';
import { photoRoutes } from '../routes/photos.js';

/**
 * Builds the Express app around an injected context, so tests can hand it an
 * in-memory database and a fake payment provider.
 *
 * Express 5 forwards rejected promises from handlers to the error middleware,
 * which is why route handlers here can be plain `async` functions.
 */
export function createApp(ctx: AppContext): Express {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', true);

  app.use((req, _res, next) => {
    req.ctx = ctx;
    next();
  });
  app.use(express.json({ limit: '256kb' }));
  app.use(express.urlencoded({ extended: false, limit: '256kb' }));
  app.use(cookieParser());
  app.use(loadSession);

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, version: '0.1.0', provider: config.paymentProvider });
  });

  app.use('/api/auth', authRoutes());
  app.use('/api/tools', toolRoutes());
  app.use('/api/loans', loanRoutes());
  app.use('/api/members', memberRoutes());
  app.use('/api/wallet', walletRoutes());
  app.use('/api/admin', adminRoutes());
  app.use('/api/photos', photoRoutes());

  app.use('/api', notFound);

  // In production this process also serves the built client.
  const indexHtml = path.join(config.webDistDir, 'index.html');
  if (fs.existsSync(indexHtml)) {
    app.use(express.static(config.webDistDir, { index: false, maxAge: '1h' }));
    app.get('*splat', (_req, res) => res.sendFile(indexHtml));
  }

  app.use(errorHandler);
  return app;
}
