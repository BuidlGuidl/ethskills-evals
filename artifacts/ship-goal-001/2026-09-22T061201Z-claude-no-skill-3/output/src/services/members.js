import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import { config } from '../config.js';
import { nowIso } from '../domain/dates.js';
import { reliability } from '../domain/reputation.js';
import { ensureAccount, memberAccount } from '../payments/ledger.js';

const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };

export function hashPassword(password) {
  const salt = randomBytes(16);
  const key = scryptSync(password, salt, SCRYPT.keylen, SCRYPT);
  return `scrypt$${SCRYPT.N}$${salt.toString('hex')}$${key.toString('hex')}`;
}

export function verifyPassword(password, stored) {
  const [scheme, n, saltHex, keyHex] = String(stored).split('$');
  if (scheme !== 'scrypt') return false;
  const key = scryptSync(password, Buffer.from(saltHex, 'hex'), keyHex.length / 2, {
    ...SCRYPT,
    N: Number(n),
  });
  const expected = Buffer.from(keyHex, 'hex');
  return key.length === expected.length && timingSafeEqual(key, expected);
}

export function createMember(handle, { email, name, password, unit = '', walletAddress = '', isAdmin = false }) {
  const cleanEmail = String(email).trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cleanEmail)) throw new ValidationError('That email address does not look right.');
  if (String(password).length < 10) throw new ValidationError('Pick a password of at least 10 characters.');
  if (!String(name).trim()) throw new ValidationError('We need a name to show your neighbours.');
  if (findByEmail(handle, cleanEmail)) throw new ValidationError('There is already an account with that email.');

  const info = handle
    .prepare(
      `INSERT INTO members (email, name, unit, password_hash, wallet_address, is_admin, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(cleanEmail, String(name).trim(), String(unit).trim(), hashPassword(password), String(walletAddress).trim(), isAdmin ? 1 : 0, nowIso());
  const id = Number(info.lastInsertRowid);
  ensureAccount(handle, memberAccount(id), 'member');
  return findById(handle, id);
}

export function findByEmail(handle, email) {
  return handle.prepare('SELECT * FROM members WHERE email = ?').get(String(email).trim().toLowerCase()) ?? null;
}

export function findById(handle, id) {
  return handle.prepare('SELECT * FROM members WHERE id = ?').get(id) ?? null;
}

export function authenticate(handle, email, password) {
  const member = findByEmail(handle, email);
  if (!member) {
    // Burn the same time as a real check so the response time does not reveal
    // whether an address belongs to a member.
    hashPassword(String(password));
    return null;
  }
  return verifyPassword(password, member.password_hash) ? member : null;
}

// --- sessions -------------------------------------------------------------

const hashToken = (token) => createHash('sha256').update(token).digest('hex');

export function startSession(handle, memberId) {
  const token = randomBytes(32).toString('base64url');
  const expires = new Date(Date.now() + config.sessionDays * 86_400_000);
  handle
    .prepare('INSERT INTO sessions (id, member_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
    .run(hashToken(token), memberId, nowIso(), expires.toISOString());
  return { token, expires };
}

export function sessionMember(handle, token) {
  if (!token) return null;
  const row = handle
    .prepare(
      `SELECT m.*, s.id AS session_id FROM sessions s
       JOIN members m ON m.id = s.member_id
       WHERE s.id = ? AND s.expires_at > ?`,
    )
    .get(hashToken(token), nowIso());
  return row ?? null;
}

export function endSession(handle, token) {
  if (token) handle.prepare('DELETE FROM sessions WHERE id = ?').run(hashToken(token));
}

export function purgeExpiredSessions(handle) {
  return handle.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(nowIso()).changes;
}

// --- track record ---------------------------------------------------------

const RECORD_SQL = `
  SELECT
    m.id AS member_id,
    COUNT(CASE WHEN l.status = 'closed' THEN 1 END)                       AS completed_loans,
    COUNT(CASE WHEN l.status = 'closed' AND l.late_days > 0 THEN 1 END)   AS late_loans,
    COALESCE(SUM(CASE WHEN l.status = 'closed' THEN l.late_days END), 0)  AS late_days,
    COUNT(CASE WHEN l.status = 'active' THEN 1 END)                       AS active_loans
  FROM members m
  LEFT JOIN loans l ON l.borrower_id = m.id
  WHERE m.id = ?
  GROUP BY m.id`;

/** A member's record as a *borrower* -- the thing owners care about. */
export function borrowingRecord(handle, memberId) {
  const row = handle.prepare(RECORD_SQL).get(memberId) ?? {
    completed_loans: 0,
    late_loans: 0,
    late_days: 0,
    active_loans: 0,
  };
  const record = {
    completedLoans: row.completed_loans,
    lateLoans: row.late_loans,
    lateDays: row.late_days,
    activeLoans: row.active_loans,
  };
  return { ...record, ...reliability(record) };
}

/** A member's record as an *owner*: how much they lend out. */
export function lendingRecord(handle, memberId) {
  const row = handle
    .prepare(
      `SELECT
         COUNT(CASE WHEN status = 'closed' THEN 1 END) AS completed,
         COUNT(CASE WHEN status = 'active' THEN 1 END) AS active
       FROM loans WHERE owner_id = ?`,
    )
    .get(memberId);
  const tools = handle
    .prepare(`SELECT COUNT(*) AS n FROM tools WHERE owner_id = ? AND status = 'listed'`)
    .get(memberId);
  return { loansGiven: row?.completed ?? 0, activeLoans: row?.active ?? 0, toolsListed: tools?.n ?? 0 };
}

export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
    this.expected = true;
  }
}
