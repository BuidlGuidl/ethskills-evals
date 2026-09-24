import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function int(value, fallback) {
  const n = Number.parseInt(value ?? '', 10);
  return Number.isFinite(n) ? n : fallback;
}

export const config = {
  root,
  port: int(process.env.PORT, 3000),
  // The association's local timezone. Due dates and late-day counting use
  // calendar days in this zone, not UTC days -- "one day late" has to mean
  // what it means to the two neighbours involved.
  timezone: process.env.TOOLSHED_TZ || 'America/New_York',
  databasePath: process.env.TOOLSHED_DB || path.join(root, 'var', 'toolshed.sqlite'),
  uploadsPath: process.env.TOOLSHED_UPLOADS || path.join(root, 'var', 'uploads'),
  // Anyone with this code can create an account. The association hands it out
  // with the membership packet. See README for rotating it.
  inviteCode: process.env.TOOLSHED_INVITE_CODE || 'neighbors',
  // Signs session cookies. Must be stable across restarts in production or
  // everyone gets logged out on deploy.
  sessionSecret: process.env.TOOLSHED_SESSION_SECRET || randomBytes(32).toString('hex'),
  sessionDays: int(process.env.TOOLSHED_SESSION_DAYS, 30),
  secureCookies: process.env.TOOLSHED_SECURE_COOKIES === 'true',
  maxPhotoBytes: int(process.env.TOOLSHED_MAX_PHOTO_BYTES, 5 * 1024 * 1024),
  // Which escrow implementation holds member deposits: 'ledger' (an internal
  // double-entry ledger, what the association runs today) or 'onchain'.
  escrowDriver: process.env.TOOLSHED_ESCROW || 'ledger',
};

export const isProduction = process.env.NODE_ENV === 'production';

if (isProduction && !process.env.TOOLSHED_SESSION_SECRET) {
  throw new Error('TOOLSHED_SESSION_SECRET must be set in production');
}
