import { nowIso } from '../domain/dates.js';

// In-app notices. v1 has no mail server: a member sees what happened on their
// dashboard the next time they open Toolshed, which for a neighbourhood
// association is enough to start with. `kind` is stable so an email or push
// sender can be attached later without rewriting the call sites.
//
// The unique index on (member, loan, kind, day) makes the nightly overdue job
// idempotent: running it twice in one day does not double up reminders.

export function notify(handle, { memberId, loanId = null, kind, body }) {
  handle
    .prepare(
      `INSERT OR IGNORE INTO notices (member_id, loan_id, kind, body, created_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(memberId, loanId, kind, body, nowIso());
}

export function unreadFor(handle, memberId, limit = 20) {
  return handle
    .prepare(
      `SELECT * FROM notices WHERE member_id = ? AND read_at IS NULL
        ORDER BY id DESC LIMIT ?`,
    )
    .all(memberId, limit);
}

export function markAllRead(handle, memberId) {
  handle
    .prepare('UPDATE notices SET read_at = ? WHERE member_id = ? AND read_at IS NULL')
    .run(nowIso(), memberId);
}
