import { nowIso } from '../domain/dates.js';
import { fromStorage, toStorage, parseUsdc } from '../domain/money.js';
import { reliability } from '../domain/reputation.js';
import { ValidationError } from './members.js';

const MAX_LOAN_DAYS = 90;

function parseAmount(value, label) {
  try {
    return parseUsdc(value);
  } catch {
    throw new ValidationError(`${label} must be an amount in USDC, like 25 or 25.50.`);
  }
}

export function validateToolInput(input) {
  const name = String(input.name ?? '').trim();
  if (name.length < 2) throw new ValidationError('Give the tool a name your neighbours would recognise.');
  if (name.length > 120) throw new ValidationError('That name is too long.');

  const deposit = parseAmount(input.deposit, 'The deposit');
  const dailyLateFee = parseAmount(input.dailyLateFee, 'The daily late fee');
  if (dailyLateFee > deposit) {
    throw new ValidationError('The daily late fee cannot be larger than the deposit -- the deposit is all there is to collect from.');
  }
  const maxDays = Number.parseInt(input.maxDays ?? '14', 10);
  if (!Number.isInteger(maxDays) || maxDays < 1 || maxDays > MAX_LOAN_DAYS) {
    throw new ValidationError(`The longest loan must be between 1 and ${MAX_LOAN_DAYS} days.`);
  }
  return {
    name,
    description: String(input.description ?? '').trim().slice(0, 2000),
    conditionNotes: String(input.conditionNotes ?? '').trim().slice(0, 2000),
    deposit,
    dailyLateFee,
    maxDays,
  };
}

export function listTool(handle, ownerId, input, photo = '') {
  const tool = validateToolInput(input);
  const info = handle
    .prepare(
      `INSERT INTO tools (owner_id, name, description, condition_notes, photo,
                          deposit_amount, daily_late_fee, max_days, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'listed', ?)`,
    )
    .run(
      ownerId,
      tool.name,
      tool.description,
      tool.conditionNotes,
      photo,
      toStorage(tool.deposit),
      toStorage(tool.dailyLateFee),
      tool.maxDays,
      nowIso(),
    );
  return getTool(handle, Number(info.lastInsertRowid));
}

export function updateTool(handle, toolId, ownerId, input, photo = null) {
  const existing = getTool(handle, toolId);
  if (!existing || existing.owner_id !== ownerId) throw new ValidationError('That is not your tool.');
  const tool = validateToolInput(input);
  handle
    .prepare(
      `UPDATE tools SET name = ?, description = ?, condition_notes = ?,
              deposit_amount = ?, daily_late_fee = ?, max_days = ?,
              photo = COALESCE(?, photo)
        WHERE id = ? AND owner_id = ?`,
    )
    .run(
      tool.name,
      tool.description,
      tool.conditionNotes,
      toStorage(tool.deposit),
      toStorage(tool.dailyLateFee),
      tool.maxDays,
      photo,
      toolId,
      ownerId,
    );
  return getTool(handle, toolId);
}

export function setToolStatus(handle, toolId, ownerId, status) {
  if (!['listed', 'retired'].includes(status)) throw new ValidationError('Unknown tool status.');
  const out = handle
    .prepare(`SELECT COUNT(*) AS n FROM loans WHERE tool_id = ? AND status IN ('requested', 'active')`)
    .get(toolId);
  if (status === 'retired' && out.n > 0) {
    throw new ValidationError('Settle the open requests and loans on this tool before retiring it.');
  }
  handle.prepare('UPDATE tools SET status = ? WHERE id = ? AND owner_id = ?').run(status, toolId, ownerId);
}

export function getTool(handle, toolId) {
  const row = handle
    .prepare(
      `SELECT t.*, m.name AS owner_name, m.unit AS owner_unit
         FROM tools t JOIN members m ON m.id = t.owner_id
        WHERE t.id = ?`,
    )
    .get(toolId);
  return row ? decorate(row) : null;
}

export function toolsOwnedBy(handle, ownerId) {
  return handle
    .prepare(
      `SELECT t.*, m.name AS owner_name, m.unit AS owner_unit
         FROM tools t JOIN members m ON m.id = t.owner_id
        WHERE t.owner_id = ? ORDER BY t.status, t.name COLLATE NOCASE`,
    )
    .all(ownerId)
    .map(decorate);
}

/**
 * The browse screen.
 *
 * A member has one track record -- the loans they have taken and how many came
 * back late -- and it follows them to both sides of the exchange. Browse ranks
 * tools by their owner's record, so the neighbours who hold up their end of
 * the deal are the ones you see first; the owner's request queue ranks
 * incoming requests by the borrower's record, so those same neighbours get
 * lent to first (see `pendingRequestsFor` in services/loans.js).
 *
 * Tools that are out on loan sink to the bottom regardless of score -- an
 * excellent neighbour whose ladder is already lent out is not the top result.
 */
export function browse(handle, { query = '', includeUnavailable = true, excludeOwnerId = null } = {}) {
  const rows = handle
    .prepare(
      `SELECT t.*, m.name AS owner_name, m.unit AS owner_unit,
              (SELECT COUNT(*) FROM loans l WHERE l.tool_id = t.id AND l.status = 'active') AS out_now,
              (SELECT COUNT(*) FROM loans l WHERE l.tool_id = t.id AND l.status = 'requested') AS pending
         FROM tools t JOIN members m ON m.id = t.owner_id
        WHERE t.status = 'listed'`,
    )
    .all()
    .map(decorate);

  const needle = String(query ?? '').trim().toLowerCase();
  const records = ownerRecords(handle);

  return rows
    .filter((tool) => (excludeOwnerId ? tool.owner_id !== excludeOwnerId : true))
    .filter((tool) => (includeUnavailable ? true : tool.out_now === 0))
    .filter((tool) =>
      !needle ||
      tool.name.toLowerCase().includes(needle) ||
      tool.description.toLowerCase().includes(needle))
    .map((tool) => ({ ...tool, ownerRecord: records.get(tool.owner_id) ?? emptyRecord() }))
    .sort((a, b) =>
      a.out_now - b.out_now ||
      b.ownerRecord.score - a.ownerRecord.score ||
      a.name.localeCompare(b.name));
}

/** Borrowing record for every member, in one query, for list screens. */
export function ownerRecords(handle) {
  const rows = handle
    .prepare(
      `SELECT m.id,
              COUNT(CASE WHEN l.status = 'closed' THEN 1 END)                      AS completed_loans,
              COUNT(CASE WHEN l.status = 'closed' AND l.late_days > 0 THEN 1 END)  AS late_loans,
              COALESCE(SUM(CASE WHEN l.status = 'closed' THEN l.late_days END), 0) AS late_days
         FROM members m LEFT JOIN loans l ON l.borrower_id = m.id
        GROUP BY m.id`,
    )
    .all();
  return new Map(
    rows.map((row) => {
      const record = {
        completedLoans: row.completed_loans,
        lateLoans: row.late_loans,
        lateDays: row.late_days,
      };
      return [row.id, { ...record, ...reliability(record) }];
    }),
  );
}

function emptyRecord() {
  const record = { completedLoans: 0, lateLoans: 0, lateDays: 0 };
  return { ...record, ...reliability(record) };
}

function decorate(row) {
  return {
    ...row,
    depositAmount: fromStorage(row.deposit_amount),
    dailyLateFee: fromStorage(row.daily_late_fee),
  };
}
