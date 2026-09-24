import { describe, expect, it } from 'vitest';
import { makeDb, makeMember, makeTool } from './helpers.js';
import { SCORE_SQL, reputationFor, scoreFor, tierFor } from '../src/domain/reputation.js';
import { approveLoan, confirmReturn, handOver, requestLoan } from '../src/domain/loans.js';
import { browseTools } from '../src/domain/tools.js';
import { DAY_MS } from '../src/lib/time.js';
import type { Db } from '../src/db/index.js';

const t0 = Date.UTC(2026, 1, 1, 9, 0, 0);

/** Runs `count` loans for a borrower, the first `late` of them returned late. */
function buildHistory(db: Db, borrowerId: string, ownerId: string, onTime: number, late: number) {
  let cursor = t0;
  for (let i = 0; i < onTime + late; i++) {
    const tool = makeTool(db, ownerId, { deposit: 100, lateFee: 5, maxDays: 2, name: `Tool ${i}` });
    const loan = requestLoan(db, { toolId: tool.id, borrowerId, days: 1, now: cursor });
    approveLoan(db, loan.id, ownerId, cursor);
    handOver(db, loan.id, ownerId, cursor);
    const isLate = i < late;
    confirmReturn(db, loan.id, ownerId, cursor + DAY_MS + (isLate ? 2 * DAY_MS : -1000));
    cursor += 10 * DAY_MS;
  }
}

describe('reputation', () => {
  it('starts new members at the prior and rewards a clean record', () => {
    expect(scoreFor(0, 0)).toBe(80);
    expect(scoreFor(5, 0)).toBe(91.1);
    expect(scoreFor(0, 5)).toBe(35.6);
    // One slip out of fifty barely registers; five out of ten does.
    expect(scoreFor(49, 1)).toBeGreaterThan(95);
    expect(scoreFor(5, 5)).toBeLessThan(65);
  });

  it('labels tiers from the score and the number of loans', () => {
    expect(tierFor(scoreFor(0, 0), 0)).toBe('new');
    expect(tierFor(scoreFor(8, 0), 8)).toBe('trusted');
    expect(tierFor(scoreFor(2, 0), 2)).toBe('reliable');
    expect(tierFor(scoreFor(3, 2), 5)).toBe('building');
    expect(tierFor(scoreFor(1, 5), 6)).toBe('watch');
  });

  it('counts real loans, and the SQL ranking agrees with the TS formula', () => {
    const db = makeDb();
    const owner = makeMember(db, { name: 'Lender', funds: 0 });
    const reliable = makeMember(db, { name: 'Reliable', funds: 5000 });
    const flaky = makeMember(db, { name: 'Flaky', funds: 5000 });

    buildHistory(db, reliable.id, owner.id, 6, 0);
    buildHistory(db, flaky.id, owner.id, 1, 3);

    const rep = reputationFor(db, reliable.id);
    expect(rep).toMatchObject({ loansBorrowed: 6, lateReturns: 0, onTimeReturns: 6, onTimeRate: 1 });
    expect(rep.tier).toBe('trusted');

    const flakyRep = reputationFor(db, flaky.id);
    expect(flakyRep).toMatchObject({ loansBorrowed: 4, lateReturns: 3, lateDays: 6 });
    expect(flakyRep.score).toBeLessThan(rep.score);

    // The ORDER BY expression used for browse must produce the same numbers.
    const rows = db
      .prepare(`SELECT s.member_id AS id, ${SCORE_SQL} AS score FROM member_stats s`)
      .all() as { id: string; score: number }[];
    for (const row of rows) {
      expect(row.score).toBeCloseTo(reputationFor(db, row.id).score, 5);
    }
  });

  it('sorts browse by the owner track record, and can sort other ways', () => {
    const db = makeDb();
    const lender = makeMember(db, { name: 'Lender', funds: 0 });
    const reliable = makeMember(db, { name: 'Reliable', funds: 5000 });
    const flaky = makeMember(db, { name: 'Flaky', funds: 5000 });
    buildHistory(db, reliable.id, lender.id, 6, 0);
    buildHistory(db, flaky.id, lender.id, 0, 3);

    // Each of them lists one tool of their own.
    const good = makeTool(db, reliable.id, { name: 'Reliable drill', deposit: 200 });
    const bad = makeTool(db, flaky.id, { name: 'Flaky drill', deposit: 10 });

    const byTrust = browseTools(db, { sort: 'trust' });
    const order = byTrust.items.map((i) => i.tool.id);
    expect(order.indexOf(good.id)).toBeLessThan(order.indexOf(bad.id));
    expect(byTrust.items[0]?.ownerReputation.score).toBeGreaterThanOrEqual(
      byTrust.items[byTrust.items.length - 1]!.ownerReputation.score,
    );

    const byDeposit = browseTools(db, { sort: 'deposit' });
    expect(byDeposit.items[0]?.tool.deposit_micros).toBeLessThanOrEqual(
      byDeposit.items[1]?.tool.deposit_micros ?? Infinity,
    );

    const searched = browseTools(db, { q: 'Flaky' });
    expect(searched.items.map((i) => i.tool.id)).toEqual([bad.id]);
    expect(searched.total).toBe(1);
  });
});
