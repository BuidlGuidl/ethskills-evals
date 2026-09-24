import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { makeApp, TINY_JPEG } from './helpers.js';
import type { Db } from '../src/db/index.js';
import { config } from '../src/config.js';
import { DAY_MS, HOUR_MS } from '../src/lib/time.js';

/** Signs up a member and returns an agent that keeps their session cookie. */
async function signUp(app: Express, name: string, email: string) {
  const agent = request.agent(app);
  const res = await agent
    .post('/api/auth/signup')
    .send({ email, password: 'a-long-enough-password', displayName: name, inviteCode: config.inviteCode });
  expect(res.status).toBe(201);
  return { agent, member: res.body.member };
}

async function topUp(agent: request.Agent, usdc: string) {
  const res = await agent.post('/api/wallet/top-up').send({ amount: usdc });
  expect(res.status).toBe(201);
}

describe('HTTP API', () => {
  let app: Express;
  let db: Db;

  beforeEach(() => {
    ({ app, db } = makeApp());
  });

  it('reports health without a session', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true, provider: 'mock' });
  });

  it('needs the association invite code to sign up', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ email: 'a@b.org', password: 'a-long-enough-password', displayName: 'Nope', inviteCode: 'wrong' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('forbidden');
  });

  it('rejects short passwords and bad emails with field details', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ email: 'not-an-email', password: 'short', displayName: 'X', inviteCode: config.inviteCode });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('invalid_request');
    expect(res.body.error.details.length).toBeGreaterThan(0);
  });

  it('logs in, keeps a session, and logs out', async () => {
    const { agent } = await signUp(app, 'Ada Alvarez', 'ada@example.org');
    const me = await agent.get('/api/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.member).toMatchObject({ displayName: 'Ada Alvarez', isAdmin: false });
    expect(me.body.member.balances.available).toMatchObject({ micros: 0, usdc: '0.00' });

    expect((await agent.post('/api/auth/logout')).status).toBe(204);
    expect((await agent.get('/api/auth/me')).status).toBe(401);

    const login = await agent
      .post('/api/auth/login')
      .send({ email: 'ada@example.org', password: 'a-long-enough-password' });
    expect(login.status).toBe(200);
    const wrong = await agent.post('/api/auth/login').send({ email: 'ada@example.org', password: 'nope' });
    expect(wrong.status).toBe(401);
    expect(wrong.body.error.code).toBe('invalid_credentials');
  });

  it('requires a session for browse', async () => {
    expect((await request(app).get('/api/tools')).status).toBe(401);
  });

  it('accepts a listing with a photo and serves it back', async () => {
    const { agent } = await signUp(app, 'Ben Boateng', 'ben@example.org');
    const res = await agent
      .post('/api/tools')
      .field('name', 'Cordless drill')
      .field('category', 'power-tools')
      .field('conditionNotes', 'Chuck sticks a little.')
      .field('deposit', '120')
      .field('lateFeePerDay', '4')
      .field('maxLoanDays', '4')
      .attach('photo', TINY_JPEG, 'drill.jpg');

    expect(res.status).toBe(201);
    expect(res.body.tool).toMatchObject({
      name: 'Cordless drill',
      deposit: { micros: 120_000_000, usdc: '120.00' },
      lateFeePerDay: { micros: 4_000_000, usdc: '4.00' },
      status: 'available',
    });
    expect(res.body.tool.photoUrl).toMatch(/^\/api\/photos\/photo_/);
  });

  it('refuses non-image uploads and late fees larger than the deposit', async () => {
    const { agent } = await signUp(app, 'Carmen Chen', 'carmen@example.org');
    const notAnImage = await agent
      .post('/api/tools')
      .field('name', 'Fake tool')
      .field('category', 'other')
      .field('deposit', '10')
      .field('lateFeePerDay', '1')
      .field('maxLoanDays', '1')
      .attach('photo', Buffer.from('<html>not an image</html>'), 'evil.jpg');
    expect(notAnImage.status).toBe(400);
    expect(notAnImage.body.error.code).toBe('unsupported_photo');

    const silly = await agent
      .post('/api/tools')
      .send({ name: 'Silly terms', category: 'other', deposit: '5', lateFeePerDay: '10', maxLoanDays: '2' });
    expect(silly.status).toBe(400);
    expect(silly.body.error.code).toBe('late_fee_over_deposit');
  });

  it('runs a whole loan: request, approve, hand over, return', async () => {
    const owner = await signUp(app, 'Owner', 'owner@example.org');
    const borrower = await signUp(app, 'Borrower', 'borrower@example.org');
    await topUp(borrower.agent, '300');

    const tool = (
      await owner.agent
        .post('/api/tools')
        .send({ name: 'Tile saw', category: 'power-tools', deposit: '100', lateFeePerDay: '5', maxLoanDays: '3' })
    ).body.tool;

    const requested = await borrower.agent
      .post('/api/loans')
      .send({ toolId: tool.id, days: 2, message: 'Bathroom job' });
    expect(requested.status).toBe(201);
    const loanId = requested.body.loan.id;
    expect(requested.body.loan).toMatchObject({ status: 'requested', deposit: { usdc: '100.00' } });

    // The deposit is held right away.
    const wallet = await borrower.agent.get('/api/wallet');
    expect(wallet.body.balances).toMatchObject({
      available: { usdc: '200.00' },
      escrow: { usdc: '100.00' },
    });

    // Only the owner can approve.
    expect((await borrower.agent.post(`/api/loans/${loanId}/approve`)).status).toBe(403);
    expect((await owner.agent.post(`/api/loans/${loanId}/approve`)).body.loan.status).toBe('approved');
    expect((await owner.agent.post(`/api/loans/${loanId}/handover`)).body.loan.status).toBe('active');

    // The owner sees it in their lending list, with the borrower's record.
    const lending = await owner.agent.get('/api/loans?role=owner&status=active');
    expect(lending.body.loans[0]).toMatchObject({ id: loanId });
    expect(lending.body.loans[0].borrower.reputation).toMatchObject({ loansBorrowed: 0, tier: 'new' });

    const returned = await owner.agent.post(`/api/loans/${loanId}/return`);
    expect(returned.body.loan).toMatchObject({ status: 'returned', lateDays: 0 });
    expect((await borrower.agent.get('/api/wallet')).body.balances.available.usdc).toBe('300.00');
    const me = await borrower.agent.get('/api/auth/me');
    expect(me.body.member.reputation).toMatchObject({ loansBorrowed: 1, lateReturns: 0 });
  });

  it('charges late fees through the maintenance endpoint', async () => {
    const owner = await signUp(app, 'Owner', 'owner2@example.org');
    const borrower = await signUp(app, 'Borrower', 'borrower2@example.org');
    db.prepare('UPDATE members SET is_admin = 1 WHERE id = ?').run(owner.member.id);
    await topUp(borrower.agent, '300');

    const tool = (
      await owner.agent
        .post('/api/tools')
        .send({ name: 'Ladder', category: 'ladders', deposit: '60', lateFeePerDay: '2', maxLoanDays: '2' })
    ).body.tool;
    const loanId = (await borrower.agent.post('/api/loans').send({ toolId: tool.id, days: 2 })).body.loan.id;
    await owner.agent.post(`/api/loans/${loanId}/approve`);
    await owner.agent.post(`/api/loans/${loanId}/handover`);

    // Pretend the loan was handed over four days ago and went overdue just
    // under two days ago, so exactly two late days are owed.
    db.prepare('UPDATE loans SET handed_over_at = ?, due_at = ? WHERE id = ?').run(
      Date.now() - 4 * DAY_MS,
      Date.now() - 2 * DAY_MS + HOUR_MS,
      loanId,
    );

    const maintenance = await owner.agent.post('/api/admin/run-maintenance');
    expect(maintenance.status).toBe(200);
    expect(maintenance.body.accrual).toMatchObject({ loansCharged: 1, charged: { usdc: '4.00' } });

    const loan = (await borrower.agent.get(`/api/loans/${loanId}`)).body.loan;
    expect(loan).toMatchObject({
      overdue: true,
      lateDaysCharged: 2,
      lateFeesCharged: { usdc: '4.00' },
      depositRemaining: { usdc: '56.00' },
    });

    await owner.agent.post(`/api/loans/${loanId}/return`);
    expect((await owner.agent.get('/api/wallet')).body.balances.available.usdc).toBe('4.00');
    expect((await borrower.agent.get('/api/wallet')).body.balances.available.usdc).toBe('296.00');

    const check = await owner.agent.get('/api/admin/ledger-check');
    expect(check.body.ok).toBe(true);
  });

  it('keeps admin endpoints away from ordinary members', async () => {
    const { agent } = await signUp(app, 'Dev Duarte', 'dev@example.org');
    expect((await agent.post('/api/admin/run-maintenance')).status).toBe(403);
    expect((await agent.get('/api/admin/ledger-check')).status).toBe(403);
  });

  it('refuses a request the borrower cannot cover', async () => {
    const owner = await signUp(app, 'Owner', 'owner3@example.org');
    const borrower = await signUp(app, 'Borrower', 'borrower3@example.org');
    await topUp(borrower.agent, '10');
    const tool = (
      await owner.agent
        .post('/api/tools')
        .send({ name: 'Jack', category: 'automotive', deposit: '130', lateFeePerDay: '4', maxLoanDays: '2' })
    ).body.tool;

    const res = await borrower.agent.post('/api/loans').send({ toolId: tool.id, days: 1 });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('insufficient_funds');
  });

  it('ranks browse and the member directory by track record', async () => {
    const owner = await signUp(app, 'Owner', 'owner4@example.org');
    const listings = [
      { name: 'Wheelbarrow', deposit: '40', fee: '1.5' },
      { name: 'Stand mixer', deposit: '65', fee: '2' },
    ];
    for (const listing of listings) {
      await owner.agent.post('/api/tools').send({
        name: listing.name,
        category: 'other',
        deposit: listing.deposit,
        lateFeePerDay: listing.fee,
        maxLoanDays: '3',
      });
    }

    const browse = await owner.agent.get('/api/tools?sort=trust');
    expect(browse.body.total).toBe(2);
    expect(browse.body.items[0].owner.reputation.score).toBe(80);

    const search = await owner.agent.get('/api/tools?q=mixer');
    expect(search.body.items.map((i: { name: string }) => i.name)).toEqual(['Stand mixer']);

    const directory = await owner.agent.get('/api/members');
    expect(directory.body.members.length).toBe(1);
    expect(directory.body.members[0].reputation.tier).toBe('new');
  });

  it('needs a payout address before a withdrawal', async () => {
    const { agent } = await signUp(app, 'Elena', 'elena@example.org');
    await topUp(agent, '50');
    const noAddress = await agent.post('/api/wallet/withdraw').send({ amount: '10' });
    expect(noAddress.status).toBe(400);
    expect(noAddress.body.error.code).toBe('no_payout_address');

    await agent.patch('/api/auth/me').send({ payoutAddress: '0x' + '1'.repeat(40) });
    expect((await agent.post('/api/wallet/withdraw').send({ amount: '10' })).status).toBe(201);
    expect((await agent.get('/api/wallet')).body.balances.available.usdc).toBe('40.00');

    const tooMuch = await agent.post('/api/wallet/withdraw').send({ amount: '1000' });
    expect(tooMuch.status).toBe(409);
  });

  it('404s unknown API routes', async () => {
    const res = await request(app).get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('not_found');
  });
});
