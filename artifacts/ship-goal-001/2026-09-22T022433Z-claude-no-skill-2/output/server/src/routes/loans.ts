import { Router } from 'express';
import { z } from 'zod';
import { pathParam, requireAuth } from '../http/context.js';
import { parse } from '../http/validate.js';
import { loanWithContext } from '../http/serialize.js';
import { ApiError } from '../lib/errors.js';
import {
  approveLoan,
  cancelLoan,
  confirmReturn,
  declineLoan,
  handOver,
  listLoans,
  requestLoan,
  requireLoan,
  type LoanStatus,
} from '../domain/loans.js';

const LOAN_STATUSES = ['requested', 'approved', 'active', 'returned', 'declined', 'cancelled'] as const;

const createSchema = z.object({
  toolId: z.string().min(1),
  days: z.coerce.number().int().min(1),
  message: z.string().max(500).optional(),
});

const listSchema = z.object({
  role: z.enum(['borrower', 'owner', 'any']).optional(),
  status: z
    .union([z.enum(LOAN_STATUSES), z.array(z.enum(LOAN_STATUSES))])
    .optional()
    .transform((v) => (v === undefined ? undefined : Array.isArray(v) ? v : [v])),
});

const declineSchema = z.object({ reason: z.string().max(300).optional() });

export function loanRoutes(): Router {
  const router = Router();

  /** Borrowing and lending in one list; the client splits them by role. */
  router.get('/', (req, res) => {
    const member = requireAuth(req);
    const query = parse(listSchema, req.query);
    const loans = listLoans(req.ctx.db, {
      memberId: member.id,
      role: query.role ?? 'any',
      statuses: query.status as LoanStatus[] | undefined,
    });
    res.json({ loans: loans.map((loan) => loanWithContext(req.ctx.db, loan)) });
  });

  router.post('/', (req, res) => {
    const member = requireAuth(req);
    const input = parse(createSchema, req.body);
    const loan = requestLoan(req.ctx.db, {
      toolId: input.toolId,
      borrowerId: member.id,
      days: input.days,
      message: input.message,
    });
    res.status(201).json({ loan: loanWithContext(req.ctx.db, loan) });
  });

  router.get('/:id', (req, res) => {
    const member = requireAuth(req);
    const loan = requireLoan(req.ctx.db, pathParam(req, 'id'));
    if (loan.owner_id !== member.id && loan.borrower_id !== member.id && !member.is_admin) {
      throw ApiError.forbidden('That loan is not yours');
    }
    res.json({ loan: loanWithContext(req.ctx.db, loan) });
  });

  const action = (
    path: string,
    run: (req: Parameters<typeof requireAuth>[0], id: string, memberId: string) => unknown,
  ) => {
    router.post(path, (req, res) => {
      const member = requireAuth(req);
      run(req, pathParam(req, 'id'), member.id);
      res.json({ loan: loanWithContext(req.ctx.db, requireLoan(req.ctx.db, pathParam(req, 'id'))) });
    });
  };

  action('/:id/approve', (req, id, memberId) => approveLoan(req.ctx.db, id, memberId));
  action('/:id/cancel', (req, id, memberId) => cancelLoan(req.ctx.db, id, memberId));
  action('/:id/handover', (req, id, memberId) => handOver(req.ctx.db, id, memberId));
  action('/:id/return', (req, id, memberId) => confirmReturn(req.ctx.db, id, memberId));

  router.post('/:id/decline', (req, res) => {
    const member = requireAuth(req);
    const { reason } = parse(declineSchema, req.body ?? {});
    declineLoan(req.ctx.db, pathParam(req, 'id'), member.id, reason ?? '');
    res.json({ loan: loanWithContext(req.ctx.db, requireLoan(req.ctx.db, pathParam(req, 'id'))) });
  });

  return router;
}
