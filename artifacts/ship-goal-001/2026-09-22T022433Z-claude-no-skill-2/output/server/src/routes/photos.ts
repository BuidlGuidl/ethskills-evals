import { Router } from 'express';
import { createReadStream, existsSync } from 'node:fs';
import { pathParam } from '../http/context.js';
import { ApiError } from '../lib/errors.js';

const CONTENT_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

export function photoRoutes(): Router {
  const router = Router();

  // Photos are not secret, but they are only interesting to members; keeping
  // them unauthenticated means <img src> works without extra plumbing.
  router.get('/:key', (req, res) => {
    const resolved = req.ctx.photos.resolve(pathParam(req, 'key'));
    if (resolved.kind === 'url') {
      res.redirect(resolved.url);
      return;
    }
    if (!existsSync(resolved.path)) throw ApiError.notFound('No such photo');
    const ext = resolved.path.split('.').pop() ?? '';
    res.setHeader('Content-Type', CONTENT_TYPES[ext] ?? 'application/octet-stream');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    createReadStream(resolved.path).pipe(res);
  });

  return router;
}
