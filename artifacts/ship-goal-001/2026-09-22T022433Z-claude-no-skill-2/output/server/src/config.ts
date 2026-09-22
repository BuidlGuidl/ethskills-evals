import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
// src/ in dev (tsx), dist/ after a build — the repo root is two levels up either way.
export const serverRoot = path.resolve(here, '..');

function str(name: string, fallback: string): string {
  const v = process.env[name];
  return v === undefined || v === '' ? fallback : v;
}

function int(name: string, fallback: number): number {
  const v = process.env[name];
  if (v === undefined || v === '') return fallback;
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error(`env ${name} must be a number, got ${JSON.stringify(v)}`);
  return Math.trunc(n);
}

function bool(name: string, fallback: boolean): boolean {
  const v = process.env[name];
  if (v === undefined || v === '') return fallback;
  return v === '1' || v.toLowerCase() === 'true';
}

const nodeEnv = str('NODE_ENV', 'development');

export const config = {
  nodeEnv,
  isProduction: nodeEnv === 'production',
  port: int('PORT', 8080),

  /** SQLite file. ':memory:' is supported and used by the test suite. */
  databaseUrl: str('DATABASE_PATH', path.join(serverRoot, 'data', 'toolshed.db')),

  /** Where tool photos are written by the local-disk photo store. */
  uploadDir: str('UPLOAD_DIR', path.join(serverRoot, 'data', 'uploads')),
  maxPhotoBytes: int('MAX_PHOTO_BYTES', 8 * 1024 * 1024),

  /** Built web client, served by the API process in production. */
  webDistDir: str('WEB_DIST_DIR', path.resolve(serverRoot, '..', 'web', 'dist')),

  /** Anyone with this code can join the association. Rotate it when the roster changes. */
  inviteCode: str('INVITE_CODE', 'maple-street'),
  /** Comma-separated emails that get the admin flag on signup/login. */
  adminEmails: str('ADMIN_EMAILS', '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),

  sessionCookieName: 'toolshed_session',
  sessionTtlDays: int('SESSION_TTL_DAYS', 30),
  secureCookies: bool('SECURE_COOKIES', nodeEnv === 'production'),

  /** 'mock' credits balances on request (dev/staging). 'usdc' is not implemented yet. */
  paymentProvider: str('PAYMENT_PROVIDER', 'mock'),
  /** Mock provider only: largest single top-up, in micro-USDC. */
  mockMaxTopUpMicros: int('MOCK_MAX_TOPUP_MICROS', 5_000_000_000),

  /** Hours after the due date before the first late fee lands. */
  lateGraceHours: int('LATE_GRACE_HOURS', 0),
  /** How often the late-fee worker sweeps active loans, in minutes. */
  accrualIntervalMinutes: int('ACCRUAL_INTERVAL_MINUTES', 15),
  runAccrualWorker: bool('RUN_ACCRUAL_WORKER', true),

  /** Guard rails on what a tool may ask for, in micro-USDC. */
  maxDepositMicros: int('MAX_DEPOSIT_MICROS', 2_000_000_000),
  maxLateFeeMicros: int('MAX_LATE_FEE_MICROS', 50_000_000),
  maxLoanDays: int('MAX_LOAN_DAYS', 90),
} as const;

export type Config = typeof config;
