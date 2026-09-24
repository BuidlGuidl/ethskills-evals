import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { config } from '../config.js';
import { pathParam, requireAuth } from '../http/context.js';
import { parse, usdcAmount } from '../http/validate.js';
import { publicMember, publicTool } from '../http/serialize.js';
import { ApiError } from '../lib/errors.js';
import { assertPhotoBytes } from '../lib/photos.js';
import { reputationFor } from '../domain/reputation.js';
import { requireMember } from '../domain/members.js';
import { listLoans, type LoanRow } from '../domain/loans.js';
import { publicLoan } from '../http/serialize.js';
import {
  CATEGORIES,
  browseTools,
  createTool,
  requireTool,
  updateTool,
  type BrowseSort,
} from '../domain/tools.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxPhotoBytes, files: 1 },
});

const categorySchema = z.enum(CATEGORIES);

const createSchema = z.object({
  name: z.string().min(2).max(120),
  category: categorySchema,
  description: z.string().max(2000).optional(),
  conditionNotes: z.string().max(2000).optional(),
  deposit: usdcAmount,
  lateFeePerDay: usdcAmount,
  maxLoanDays: z.coerce.number().int().min(1).max(config.maxLoanDays),
});

const updateSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  category: categorySchema.optional(),
  description: z.string().max(2000).optional(),
  conditionNotes: z.string().max(2000).optional(),
  deposit: usdcAmount.optional(),
  lateFeePerDay: usdcAmount.optional(),
  maxLoanDays: z.coerce.number().int().min(1).max(config.maxLoanDays).optional(),
  status: z.enum(['available', 'retired']).optional(),
  removePhoto: z.coerce.boolean().optional(),
});

const browseSchema = z.object({
  sort: z.enum(['trust', 'newest', 'deposit']).optional(),
  q: z.string().max(120).optional(),
  category: z.string().max(40).optional(),
  ownerId: z.string().max(40).optional(),
  availableOnly: z
    .union([z.literal('true'), z.literal('false'), z.boolean()])
    .transform((v) => v === true || v === 'true')
    .optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export function toolRoutes(): Router {
  const router = Router();

  router.get('/', (req, res) => {
    requireAuth(req);
    const query = parse(browseSchema, req.query);
    const result = browseTools(req.ctx.db, { ...query, sort: query.sort as BrowseSort | undefined });
    res.json({
      total: result.total,
      sort: query.sort ?? 'trust',
      items: result.items.map((item) => ({
        ...publicTool(item.tool),
        owner: { ...item.owner, reputation: item.ownerReputation },
      })),
    });
  });

  router.get('/categories', (_req, res) => {
    res.json({ categories: CATEGORIES });
  });

  router.post('/', upload.single('photo'), async (req, res) => {
    const member = requireAuth(req);
    const input = parse(createSchema, req.body);
    let photoKey: string | null = null;
    if (req.file) {
      assertPhotoBytes(req.file.buffer);
      photoKey = (await req.ctx.photos.put(req.file.buffer)).key;
    }
    const tool = createTool(req.ctx.db, {
      ownerId: member.id,
      name: input.name,
      category: input.category,
      description: input.description,
      conditionNotes: input.conditionNotes,
      photoKey,
      depositMicros: input.deposit,
      lateFeeMicros: input.lateFeePerDay,
      maxLoanDays: input.maxLoanDays,
    });
    res.status(201).json({ tool: publicTool(tool) });
  });

  router.get('/:id', (req, res) => {
    const viewer = requireAuth(req);
    const db = req.ctx.db;
    const tool = requireTool(db, pathParam(req, 'id'));
    const owner = requireMember(db, tool.owner_id);
    // Owners see the queue of requests on their own listing.
    const requests =
      owner.id === viewer.id
        ? listLoans(db, { memberId: viewer.id, role: 'owner', statuses: ['requested'] })
            .filter((loan) => loan.tool_id === tool.id)
            .map((loan) => ({
              ...publicLoan(db, loan),
              borrower: publicMember(requireMember(db, loan.borrower_id), reputationFor(db, loan.borrower_id)),
            }))
        : undefined;
    const activeLoan = db
      .prepare(`SELECT * FROM loans WHERE tool_id = ? AND status IN ('approved', 'active')`)
      .get(tool.id) as LoanRow | undefined;

    res.json({
      tool: publicTool(tool),
      owner: publicMember(owner, reputationFor(db, owner.id)),
      activeLoan: activeLoan ? publicLoan(db, activeLoan) : null,
      requests,
    });
  });

  router.patch('/:id', upload.single('photo'), async (req, res) => {
    const member = requireAuth(req);
    const input = parse(updateSchema, req.body);
    const existing = requireTool(req.ctx.db, pathParam(req, 'id'));
    if (existing.owner_id !== member.id) throw ApiError.forbidden('Only the owner can edit this tool');

    let photoKey: string | null | undefined;
    if (req.file) {
      assertPhotoBytes(req.file.buffer);
      photoKey = (await req.ctx.photos.put(req.file.buffer)).key;
    }
    else if (input.removePhoto) photoKey = null;

    const tool = updateTool(req.ctx.db, existing.id, member.id, {
      name: input.name,
      category: input.category,
      description: input.description,
      conditionNotes: input.conditionNotes,
      photoKey,
      depositMicros: input.deposit,
      lateFeeMicros: input.lateFeePerDay,
      maxLoanDays: input.maxLoanDays,
      status: input.status,
    });
    // Best effort: a stale photo left on disk is harmless, a failed edit is not.
    if (photoKey !== undefined && existing.photo_key && existing.photo_key !== photoKey) {
      req.ctx.photos.delete(existing.photo_key).catch(() => {});
    }
    res.json({ tool: publicTool(tool) });
  });

  return router;
}
