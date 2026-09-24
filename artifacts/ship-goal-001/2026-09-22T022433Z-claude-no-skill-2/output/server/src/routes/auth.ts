import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { config } from '../config.js';
import { requireAuth } from '../http/context.js';
import { parse } from '../http/validate.js';
import { privateMember } from '../http/serialize.js';
import { balances } from '../domain/ledger.js';
import { reputationFor } from '../domain/reputation.js';
import {
  authenticate,
  createMember,
  createSession,
  deleteSession,
  requireMember,
  updateProfile,
} from '../domain/members.js';

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(10, 'Use at least 10 characters').max(200),
  displayName: z.string().min(2).max(80),
  unit: z.string().max(40).optional(),
  phone: z.string().max(40).optional(),
  inviteCode: z.string().min(1, 'The association invite code is required'),
});

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });

const profileSchema = z.object({
  displayName: z.string().min(2).max(80).optional(),
  unit: z.string().max(40).nullish(),
  phone: z.string().max(40).nullish(),
  payoutAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, 'Expected an EVM address like 0x1234...')
    .nullish(),
});

export function authRoutes(): Router {
  const router = Router();

  router.post('/signup', (req, res) => {
    const input = parse(signupSchema, req.body);
    const member = createMember(req.ctx.db, input);
    setSessionCookie(req, res, member.id);
    res.status(201).json({ member: me(req, member.id) });
  });

  router.post('/login', (req, res) => {
    const input = parse(loginSchema, req.body);
    const member = authenticate(req.ctx.db, input.email, input.password);
    setSessionCookie(req, res, member.id);
    res.json({ member: me(req, member.id) });
  });

  router.post('/logout', (req, res) => {
    const token = req.cookies?.[config.sessionCookieName];
    if (typeof token === 'string') deleteSession(req.ctx.db, token);
    res.clearCookie(config.sessionCookieName, cookieOptions());
    res.status(204).end();
  });

  router.get('/me', (req, res) => {
    const member = requireAuth(req);
    res.json({ member: me(req, member.id) });
  });

  router.patch('/me', (req, res) => {
    const member = requireAuth(req);
    const patch = parse(profileSchema, req.body);
    updateProfile(req.ctx.db, member.id, patch);
    res.json({ member: me(req, member.id) });
  });

  return router;
}

function me(req: Request, memberId: string) {
  const db = req.ctx.db;
  return privateMember(requireMember(db, memberId), reputationFor(db, memberId), balances(db, memberId));
}

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: config.secureCookies,
    path: '/',
  };
}

function setSessionCookie(req: Request, res: Response, memberId: string) {
  const session = createSession(req.ctx.db, memberId);
  res.cookie(config.sessionCookieName, session.token, {
    ...cookieOptions(),
    expires: new Date(session.expiresAt),
  });
}
