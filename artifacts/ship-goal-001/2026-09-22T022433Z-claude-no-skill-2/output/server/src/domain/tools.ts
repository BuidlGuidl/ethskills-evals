import type { Db } from '../db/index.js';
import { config } from '../config.js';
import { ApiError } from '../lib/errors.js';
import { newId } from '../lib/ids.js';
import { formatUsdc } from '../lib/money.js';
import { SCORE_SQL, type Reputation, reputationMap } from './reputation.js';

export type ToolStatus = 'available' | 'lent_out' | 'retired';

export interface ToolRow {
  id: string;
  owner_id: string;
  name: string;
  category: string;
  description: string;
  condition_notes: string;
  photo_key: string | null;
  deposit_micros: number;
  late_fee_micros: number;
  max_loan_days: number;
  status: ToolStatus;
  created_at: number;
  updated_at: number;
}

export interface CreateToolInput {
  ownerId: string;
  name: string;
  category: string;
  description?: string;
  conditionNotes?: string;
  photoKey?: string | null;
  depositMicros: number;
  lateFeeMicros: number;
  maxLoanDays: number;
}

export const CATEGORIES = [
  'power-tools',
  'hand-tools',
  'garden',
  'ladders',
  'automotive',
  'painting',
  'cleaning',
  'kitchen',
  'other',
] as const;

function validateTerms(input: { depositMicros: number; lateFeeMicros: number; maxLoanDays: number }) {
  if (input.depositMicros < 0 || input.depositMicros > config.maxDepositMicros) {
    throw ApiError.badRequest(
      'invalid_deposit',
      `Deposit must be between 0 and ${formatUsdc(config.maxDepositMicros)} USDC`,
    );
  }
  if (input.lateFeeMicros < 0 || input.lateFeeMicros > config.maxLateFeeMicros) {
    throw ApiError.badRequest(
      'invalid_late_fee',
      `Late fee must be between 0 and ${formatUsdc(config.maxLateFeeMicros)} USDC per day`,
    );
  }
  if (input.maxLoanDays < 1 || input.maxLoanDays > config.maxLoanDays) {
    throw ApiError.badRequest('invalid_loan_days', `Loan length must be 1-${config.maxLoanDays} days`);
  }
  // A late fee bigger than the deposit would be uncollectable on day one.
  if (input.lateFeeMicros > input.depositMicros) {
    throw ApiError.badRequest(
      'late_fee_over_deposit',
      'The daily late fee cannot be larger than the deposit it comes out of',
    );
  }
}

export function createTool(db: Db, input: CreateToolInput): ToolRow {
  validateTerms(input);
  const now = Date.now();
  const row: ToolRow = {
    id: newId('tool'),
    owner_id: input.ownerId,
    name: input.name.trim(),
    category: input.category,
    description: (input.description ?? '').trim(),
    condition_notes: (input.conditionNotes ?? '').trim(),
    photo_key: input.photoKey ?? null,
    deposit_micros: input.depositMicros,
    late_fee_micros: input.lateFeeMicros,
    max_loan_days: input.maxLoanDays,
    status: 'available',
    created_at: now,
    updated_at: now,
  };
  db.prepare(
    `INSERT INTO tools (id, owner_id, name, category, description, condition_notes, photo_key,
                        deposit_micros, late_fee_micros, max_loan_days, status, created_at, updated_at)
     VALUES (@id, @owner_id, @name, @category, @description, @condition_notes, @photo_key,
             @deposit_micros, @late_fee_micros, @max_loan_days, @status, @created_at, @updated_at)`,
  ).run(row);
  return row;
}

export function getTool(db: Db, id: string): ToolRow | undefined {
  return db.prepare('SELECT * FROM tools WHERE id = ?').get(id) as ToolRow | undefined;
}

export function requireTool(db: Db, id: string): ToolRow {
  const tool = getTool(db, id);
  if (!tool) throw ApiError.notFound('No such tool');
  return tool;
}

export interface UpdateToolInput {
  name?: string;
  category?: string;
  description?: string;
  conditionNotes?: string;
  photoKey?: string | null;
  depositMicros?: number;
  lateFeeMicros?: number;
  maxLoanDays?: number;
  status?: Extract<ToolStatus, 'available' | 'retired'>;
}

export function updateTool(db: Db, toolId: string, ownerId: string, patch: UpdateToolInput): ToolRow {
  const tool = requireTool(db, toolId);
  if (tool.owner_id !== ownerId) throw ApiError.forbidden('Only the owner can edit this tool');

  const next = {
    name: patch.name?.trim() ?? tool.name,
    category: patch.category ?? tool.category,
    description: patch.description?.trim() ?? tool.description,
    condition_notes: patch.conditionNotes?.trim() ?? tool.condition_notes,
    photo_key: patch.photoKey === undefined ? tool.photo_key : patch.photoKey,
    deposit_micros: patch.depositMicros ?? tool.deposit_micros,
    late_fee_micros: patch.lateFeeMicros ?? tool.late_fee_micros,
    max_loan_days: patch.maxLoanDays ?? tool.max_loan_days,
    status: patch.status ?? tool.status,
  };
  validateTerms({
    depositMicros: next.deposit_micros,
    lateFeeMicros: next.late_fee_micros,
    maxLoanDays: next.max_loan_days,
  });
  if (tool.status === 'lent_out' && patch.status) {
    throw ApiError.conflict('tool_lent_out', 'Wait until the tool is back before changing its listing status');
  }
  db.prepare(
    `UPDATE tools SET name = @name, category = @category, description = @description,
            condition_notes = @condition_notes, photo_key = @photo_key, deposit_micros = @deposit_micros,
            late_fee_micros = @late_fee_micros, max_loan_days = @max_loan_days, status = @status,
            updated_at = @updated_at
      WHERE id = @id`,
  ).run({ ...next, id: toolId, updated_at: Date.now() });
  return requireTool(db, toolId);
}

export function setToolStatus(db: Db, toolId: string, status: ToolStatus): void {
  db.prepare('UPDATE tools SET status = ?, updated_at = ? WHERE id = ?').run(status, Date.now(), toolId);
}

// --- browse ----------------------------------------------------------------

export type BrowseSort = 'trust' | 'newest' | 'deposit';

export interface BrowseQuery {
  sort?: BrowseSort;
  q?: string;
  category?: string;
  ownerId?: string;
  includeRetired?: boolean;
  availableOnly?: boolean;
  limit?: number;
  offset?: number;
}

export interface BrowseItem {
  tool: ToolRow;
  owner: { id: string; displayName: string; unit: string | null };
  ownerReputation: Reputation;
}

export interface BrowseResult {
  items: BrowseItem[];
  total: number;
}

/**
 * The browse screen. Default ordering is by the owner's track record, so the
 * members who look after the library surface first; ties break on newest.
 */
export function browseTools(db: Db, query: BrowseQuery): BrowseResult {
  const where: string[] = [];
  const params: Record<string, unknown> = {};

  if (!query.includeRetired) where.push(`t.status != 'retired'`);
  if (query.availableOnly) where.push(`t.status = 'available'`);
  if (query.category) {
    where.push('t.category = @category');
    params.category = query.category;
  }
  if (query.ownerId) {
    where.push('t.owner_id = @ownerId');
    params.ownerId = query.ownerId;
  }
  if (query.q) {
    // Escape the LIKE wildcards so a search for "50%" is a literal search.
    where.push(
      `(t.name LIKE @q ESCAPE '\\' OR t.description LIKE @q ESCAPE '\\'` +
        ` OR t.condition_notes LIKE @q ESCAPE '\\')`,
    );
    params.q = `%${query.q.replace(/[%_\\]/g, (m) => `\\${m}`)}%`;
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const order =
    query.sort === 'newest'
      ? 't.created_at DESC'
      : query.sort === 'deposit'
        ? 't.deposit_micros ASC, t.created_at DESC'
        : `${SCORE_SQL} DESC, s.loans_lent DESC, t.created_at DESC`;

  const limit = Math.min(Math.max(query.limit ?? 40, 1), 100);
  const offset = Math.max(query.offset ?? 0, 0);

  const rows = db
    .prepare(
      `SELECT t.*, m.display_name AS owner_name, m.unit AS owner_unit
         FROM tools t
         JOIN members m ON m.id = t.owner_id
         JOIN member_stats s ON s.member_id = t.owner_id
         ${whereSql}
         ORDER BY ${order}
         LIMIT @limit OFFSET @offset`,
    )
    .all({ ...params, limit, offset }) as (ToolRow & { owner_name: string; owner_unit: string | null })[];

  const total = (
    db
      .prepare(
        `SELECT COUNT(*) AS n FROM tools t JOIN members m ON m.id = t.owner_id
           JOIN member_stats s ON s.member_id = t.owner_id ${whereSql}`,
      )
      .get(params) as { n: number }
  ).n;

  const reps = reputationMap(db, rows.map((r) => r.owner_id));
  const items = rows.map((row) => {
    const { owner_name, owner_unit, ...tool } = row;
    return {
      tool: tool as ToolRow,
      owner: { id: row.owner_id, displayName: owner_name, unit: owner_unit },
      ownerReputation: reps.get(row.owner_id)!,
    };
  });
  return { items, total };
}
