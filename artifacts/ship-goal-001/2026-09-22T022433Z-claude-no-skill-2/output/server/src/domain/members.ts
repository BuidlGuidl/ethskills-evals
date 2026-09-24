import type { Db } from '../db/index.js';
import { config } from '../config.js';
import { ApiError } from '../lib/errors.js';
import { newId, newToken } from '../lib/ids.js';
import { hashPassword, verifyPassword } from '../lib/password.js';
import { DAY_MS } from '../lib/time.js';

export interface MemberRow {
  id: string;
  email: string;
  display_name: string;
  unit: string | null;
  phone: string | null;
  password_hash: string;
  is_admin: number;
  payout_address: string | null;
  created_at: number;
}

export interface SignupInput {
  email: string;
  password: string;
  displayName: string;
  unit?: string | null;
  phone?: string | null;
  inviteCode: string;
}

export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function findMemberByEmail(db: Db, email: string): MemberRow | undefined {
  return db.prepare('SELECT * FROM members WHERE email = ?').get(normaliseEmail(email)) as
    | MemberRow
    | undefined;
}

export function getMember(db: Db, id: string): MemberRow | undefined {
  return db.prepare('SELECT * FROM members WHERE id = ?').get(id) as MemberRow | undefined;
}

export function requireMember(db: Db, id: string): MemberRow {
  const member = getMember(db, id);
  if (!member) throw ApiError.notFound('No such member');
  return member;
}

export function createMember(db: Db, input: SignupInput): MemberRow {
  if (input.inviteCode.trim() !== config.inviteCode) {
    throw ApiError.forbidden('That invite code is not valid for this association');
  }
  const email = normaliseEmail(input.email);
  if (findMemberByEmail(db, email)) {
    throw ApiError.conflict('email_taken', 'That email is already registered');
  }
  const now = Date.now();
  const member: MemberRow = {
    id: newId('mem'),
    email,
    display_name: input.displayName.trim(),
    unit: input.unit?.trim() || null,
    phone: input.phone?.trim() || null,
    password_hash: hashPassword(input.password),
    is_admin: config.adminEmails.includes(email) ? 1 : 0,
    payout_address: null,
    created_at: now,
  };
  db.prepare(
    `INSERT INTO members (id, email, display_name, unit, phone, password_hash, is_admin, payout_address, created_at)
     VALUES (@id, @email, @display_name, @unit, @phone, @password_hash, @is_admin, @payout_address, @created_at)`,
  ).run(member);
  return member;
}

export function authenticate(db: Db, email: string, password: string): MemberRow {
  const member = findMemberByEmail(db, email);
  // Same error either way: don't leak which emails are members.
  if (!member || !verifyPassword(password, member.password_hash)) {
    throw new ApiError(401, 'invalid_credentials', 'Email or password is incorrect');
  }
  return member;
}

export function createSession(db: Db, memberId: string): { token: string; expiresAt: number } {
  const token = newToken();
  const now = Date.now();
  const expiresAt = now + config.sessionTtlDays * DAY_MS;
  db.prepare('INSERT INTO sessions (token, member_id, created_at, expires_at) VALUES (?, ?, ?, ?)').run(
    token,
    memberId,
    now,
    expiresAt,
  );
  return { token, expiresAt };
}

export function memberForSession(db: Db, token: string): MemberRow | undefined {
  const row = db
    .prepare(
      `SELECT m.* FROM sessions s JOIN members m ON m.id = s.member_id
        WHERE s.token = ? AND s.expires_at > ?`,
    )
    .get(token, Date.now()) as MemberRow | undefined;
  return row;
}

export function deleteSession(db: Db, token: string): void {
  db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

export function deleteExpiredSessions(db: Db): number {
  return db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(Date.now()).changes;
}

export function updateProfile(
  db: Db,
  memberId: string,
  patch: { displayName?: string; unit?: string | null; phone?: string | null; payoutAddress?: string | null },
): MemberRow {
  const member = requireMember(db, memberId);
  db.prepare(
    `UPDATE members SET display_name = ?, unit = ?, phone = ?, payout_address = ? WHERE id = ?`,
  ).run(
    patch.displayName?.trim() || member.display_name,
    patch.unit === undefined ? member.unit : patch.unit?.trim() || null,
    patch.phone === undefined ? member.phone : patch.phone?.trim() || null,
    patch.payoutAddress === undefined ? member.payout_address : patch.payoutAddress?.trim() || null,
    memberId,
  );
  return requireMember(db, memberId);
}
