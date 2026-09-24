import type { Request } from 'express';
import type { Db } from '../db/index.js';
import type { PaymentProvider } from '../payments/index.js';
import type { PhotoStore } from '../lib/photos.js';
import type { MemberRow } from '../domain/members.js';
import { ApiError } from '../lib/errors.js';

/** Everything a route handler is allowed to reach for, injected at app build. */
export interface AppContext {
  db: Db;
  payments: PaymentProvider;
  photos: PhotoStore;
}

declare module 'express-serve-static-core' {
  interface Request {
    ctx: AppContext;
    member?: MemberRow;
  }
}

/** Express 5 types path params loosely; routes here always want one string. */
export function pathParam(req: Request, name: string): string {
  const value = req.params[name];
  if (typeof value !== 'string' || value.length === 0) throw ApiError.notFound();
  return value;
}

export function requireAuth(req: Request): MemberRow {
  if (!req.member) throw ApiError.unauthorized();
  return req.member;
}

export function requireAdmin(req: Request): MemberRow {
  const member = requireAuth(req);
  if (!member.is_admin) throw ApiError.forbidden('Admins only');
  return member;
}
