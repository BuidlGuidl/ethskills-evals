import { Router } from 'express';
import { z } from 'zod';
import { config } from '../config.js';
import { requireAuth } from '../http/context.js';
import { parse, usdcAmount } from '../http/validate.js';
import { money, publicLedgerRow } from '../http/serialize.js';
import { ApiError } from '../lib/errors.js';
import { balances, history, topUp, withdraw } from '../domain/ledger.js';

const amountSchema = z.object({ amount: usdcAmount });

export function walletRoutes(): Router {
  const router = Router();

  router.get('/', (req, res) => {
    const member = requireAuth(req);
    const db = req.ctx.db;
    const bal = balances(db, member.id);
    res.json({
      balances: { available: money(bal.available), escrow: money(bal.escrow) },
      provider: config.paymentProvider,
      entries: history(db, member.id, 100).map(publicLedgerRow),
    });
  });

  router.get('/deposit-instructions', async (req, res) => {
    const member = requireAuth(req);
    res.json({ instructions: await req.ctx.payments.depositInstructions(member.id) });
  });

  /**
   * Test-mode top-up. With a real provider this endpoint goes away and the
   * chain watcher calls ledger.topUp() once a transfer is confirmed.
   */
  router.post('/top-up', async (req, res) => {
    const member = requireAuth(req);
    const { amount } = parse(amountSchema, req.body);
    if (config.paymentProvider !== 'mock') {
      throw ApiError.forbidden('Top-ups are credited by the chain watcher, not this endpoint');
    }
    const { reference } = await req.ctx.payments.confirmTopUp(member.id, amount);
    topUp(req.ctx.db, member.id, amount, reference);
    res.status(201).json({ balances: balances(req.ctx.db, member.id) });
  });

  router.post('/withdraw', async (req, res) => {
    const member = requireAuth(req);
    const { amount } = parse(amountSchema, req.body);
    if (amount <= 0) throw ApiError.badRequest('invalid_amount', 'Withdrawal must be positive');
    if (!member.payout_address) {
      throw ApiError.badRequest('no_payout_address', 'Add a payout address to your profile first');
    }
    const available = balances(req.ctx.db, member.id).available;
    if (amount > available) {
      throw ApiError.conflict('insufficient_funds', 'That is more than your available balance');
    }
    const { reference } = await req.ctx.payments.payout(member.id, amount, member.payout_address);
    // Debit after the provider accepts, so a failed payout leaves the balance alone.
    withdraw(req.ctx.db, member.id, amount, reference);
    res.status(201).json({ balances: balances(req.ctx.db, member.id) });
  });

  return router;
}
