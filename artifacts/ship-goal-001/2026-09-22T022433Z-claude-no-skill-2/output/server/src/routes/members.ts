import { Router } from 'express';
import { z } from 'zod';
import { pathParam, requireAuth } from '../http/context.js';
import { parse } from '../http/validate.js';
import { publicMember, publicTool } from '../http/serialize.js';
import { requireMember } from '../domain/members.js';
import { reputationFor, reputationMap, SCORE_SQL } from '../domain/reputation.js';
import { browseTools } from '../domain/tools.js';
import type { MemberRow } from '../domain/members.js';

const directorySchema = z.object({
  q: z.string().max(80).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export function memberRoutes(): Router {
  const router = Router();

  /** The roster, best track record first - the same ranking browse uses. */
  router.get('/', (req, res) => {
    requireAuth(req);
    const db = req.ctx.db;
    const query = parse(directorySchema, req.query);
    const params: Record<string, unknown> = {
      limit: query.limit ?? 50,
      offset: query.offset ?? 0,
    };
    let where = '';
    if (query.q) {
      where = 'WHERE m.display_name LIKE @q';
      params.q = `%${query.q.replace(/[%_\\]/g, (m) => `\\${m}`)}%`;
    }
    const rows = db
      .prepare(
        `SELECT m.* FROM members m JOIN member_stats s ON s.member_id = m.id
         ${where}
         ORDER BY ${SCORE_SQL} DESC, s.loans_borrowed DESC, m.display_name ASC
         LIMIT @limit OFFSET @offset`,
      )
      .all(params) as MemberRow[];
    const reps = reputationMap(db, rows.map((r) => r.id));
    res.json({ members: rows.map((row) => publicMember(row, reps.get(row.id))) });
  });

  router.get('/:id', (req, res) => {
    requireAuth(req);
    const db = req.ctx.db;
    const member = requireMember(db, pathParam(req, 'id'));
    const tools = browseTools(db, { ownerId: member.id, sort: 'newest', limit: 100 });
    res.json({
      member: publicMember(member, reputationFor(db, member.id)),
      tools: tools.items.map((item) => publicTool(item.tool)),
    });
  });

  return router;
}
