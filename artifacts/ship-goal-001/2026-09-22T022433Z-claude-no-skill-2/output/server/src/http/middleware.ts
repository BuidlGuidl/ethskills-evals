import type { ErrorRequestHandler, RequestHandler } from 'express';
import { config } from '../config.js';
import { ApiError } from '../lib/errors.js';
import { memberForSession } from '../domain/members.js';

/** Attaches req.member when a valid session cookie is present. Never rejects. */
export const loadSession: RequestHandler = (req, _res, next) => {
  const token = req.cookies?.[config.sessionCookieName];
  if (typeof token === 'string' && token.length > 0) {
    req.member = memberForSession(req.ctx.db, token);
  }
  next();
};

export const notFound: RequestHandler = (_req, _res, next) => {
  next(ApiError.notFound('No such endpoint'));
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ApiError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
    return;
  }
  // Multer's own limit error, surfaced in the shape clients expect.
  if (typeof err === 'object' && err && (err as { code?: string }).code === 'LIMIT_FILE_SIZE') {
    res.status(400).json({ error: { code: 'photo_too_large', message: 'Photos must be under 8 MB' } });
    return;
  }
  console.error('[toolshed] unhandled error', err);
  res.status(500).json({
    error: {
      code: 'internal_error',
      message: config.isProduction ? 'Something went wrong' : String(err instanceof Error ? err.stack : err),
    },
  });
};
