/**
 * Fills a database with a plausible neighbourhood so the browse ranking, late
 * fees and track records have something to show. Safe to re-run: it refuses to
 * touch a database that already has members unless SEED_RESET=1.
 *
 *   npm run seed                 # into the configured DATABASE_PATH
 *   SEED_RESET=1 npm run seed    # wipe first
 *
 * Every seeded member's password is "toolshed-demo-1".
 */
import { config } from '../config.js';
import { openDb, type Db } from '../db/index.js';
import { createMember } from '../domain/members.js';
import { createTool, CATEGORIES, type ToolRow } from '../domain/tools.js';
import { approveLoan, confirmReturn, handOver, requestLoan } from '../domain/loans.js';
import { topUp } from '../domain/ledger.js';
import { usdcToMicros } from '../lib/money.js';
import { DAY_MS, HOUR_MS } from '../lib/time.js';

const PASSWORD = 'toolshed-demo-1';

/** Deterministic PRNG so seeded data is the same on every machine. */
function rng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

const FIRST = ['Ada', 'Ben', 'Carmen', 'Dev', 'Elena', 'Femi', 'Grace', 'Hana', 'Ivan', 'Jo', 'Kwame', 'Lena', 'Mira', 'Noah', 'Omar', 'Priya', 'Quinn', 'Rosa', 'Sam', 'Tariq', 'Uma', 'Vic', 'Wes', 'Yara'];
const LAST = ['Alvarez', 'Boateng', 'Chen', 'Duarte', 'Eriksen', 'Fischer', 'Gupta', 'Haddad', 'Ibarra', 'Jensen', 'Kowalski', 'Lindqvist', 'Moreau', 'Nakamura', 'Okafor', 'Petrov'];

const TOOLS: { name: string; category: (typeof CATEGORIES)[number]; deposit: number; lateFee: number; days: number; condition: string }[] = [
  { name: 'DeWalt 20V hammer drill', category: 'power-tools', deposit: 120, lateFee: 4, days: 4, condition: 'Chuck sticks a little; two batteries, both hold charge.' },
  { name: 'Circular saw (7-1/4")', category: 'power-tools', deposit: 90, lateFee: 3, days: 3, condition: 'Blade replaced last spring. Guard is stiff.' },
  { name: '8ft fibreglass stepladder', category: 'ladders', deposit: 60, lateFee: 2, days: 5, condition: 'Paint-spattered but solid. One foot pad missing.' },
  { name: '24ft extension ladder', category: 'ladders', deposit: 150, lateFee: 5, days: 2, condition: 'Heavy - bring a second person.' },
  { name: 'Wheelbarrow', category: 'garden', deposit: 40, lateFee: 1.5, days: 7, condition: 'Tyre needs air most weeks.' },
  { name: 'Petrol hedge trimmer', category: 'garden', deposit: 110, lateFee: 4, days: 2, condition: 'Return it with fuel, please. Starts on the third pull.' },
  { name: 'Lawn aerator', category: 'garden', deposit: 75, lateFee: 2.5, days: 3, condition: 'Tines are sharp, keep away from kids.' },
  { name: 'Socket set (metric, 108pc)', category: 'hand-tools', deposit: 55, lateFee: 2, days: 7, condition: 'Complete as of last check. 10mm always goes missing - count it.' },
  { name: 'Pipe wrench pair', category: 'hand-tools', deposit: 35, lateFee: 1, days: 7, condition: 'Jaws re-cut, grip is good.' },
  { name: 'Torque wrench', category: 'automotive', deposit: 80, lateFee: 3, days: 3, condition: 'Calibrated Feb. Do not use as a breaker bar.' },
  { name: 'Hydraulic trolley jack (2t)', category: 'automotive', deposit: 130, lateFee: 4, days: 2, condition: 'Seal weeps a little under load.' },
  { name: 'Wet/dry shop vacuum', category: 'cleaning', deposit: 70, lateFee: 2, days: 4, condition: 'Empty the drum before returning. Spare filter in the bag.' },
  { name: 'Carpet cleaner', category: 'cleaning', deposit: 95, lateFee: 3, days: 2, condition: 'Works well, hose clip is broken.' },
  { name: 'Airless paint sprayer', category: 'painting', deposit: 140, lateFee: 5, days: 3, condition: 'Must be flushed within an hour of use.' },
  { name: 'Wallpaper steamer', category: 'painting', deposit: 45, lateFee: 1.5, days: 4, condition: 'Slow to heat. Long cord.' },
  { name: 'Tile saw', category: 'power-tools', deposit: 100, lateFee: 3.5, days: 4, condition: 'Water tray leaks; use it outside.' },
  { name: 'Stand mixer (6qt)', category: 'kitchen', deposit: 65, lateFee: 2, days: 5, condition: 'Dough hook and whisk included. Bowl has scratches.' },
  { name: '20-cup coffee urn', category: 'kitchen', deposit: 30, lateFee: 1, days: 3, condition: 'For block parties. Descale after use.' },
  { name: 'Folding trestle tables (pair)', category: 'other', deposit: 50, lateFee: 1.5, days: 5, condition: 'One leg latch needs a thump.' },
  { name: 'Moving dolly + straps', category: 'other', deposit: 40, lateFee: 1.5, days: 4, condition: 'Straps fraying at the hooks.' },
];

interface History {
  onTime: number;
  late: number;
  /** Late returns are this many days over, in order. */
  lateBy: number[];
}

// A spread of track records: a few very reliable members, a couple of repeat
// offenders, and some brand-new members with no history at all.
const HISTORIES: History[] = [
  { onTime: 9, late: 0, lateBy: [] },
  { onTime: 7, late: 1, lateBy: [1] },
  { onTime: 6, late: 0, lateBy: [] },
  { onTime: 5, late: 2, lateBy: [2, 1] },
  { onTime: 4, late: 0, lateBy: [] },
  { onTime: 3, late: 3, lateBy: [3, 1, 2] },
  { onTime: 2, late: 0, lateBy: [] },
  { onTime: 1, late: 4, lateBy: [5, 2, 1, 40] },
  { onTime: 2, late: 1, lateBy: [1] },
  { onTime: 0, late: 0, lateBy: [] },
];

/**
 * Tools change status as loans are created, so candidates always come from the
 * database rather than the in-memory list built at insert time.
 */
function pickAvailableTool(db: Db, excludeOwnerId: string, pick: number, skip: Set<string> = new Set()): ToolRow | undefined {
  const rows = db
    .prepare(`SELECT * FROM tools WHERE status = 'available' AND owner_id != ? ORDER BY created_at`)
    .all(excludeOwnerId) as ToolRow[];
  const candidates = rows.filter((t) => !skip.has(t.id));
  if (candidates.length === 0) return undefined;
  return candidates[Math.floor(pick * candidates.length) % candidates.length];
}

function seed(db: Db) {
  const random = rng(20260921);
  const now = Date.now();

  const members = FIRST.map((first, i) => {
    const last = LAST[i % LAST.length]!;
    return createMember(db, {
      email: `${first.toLowerCase()}.${last.toLowerCase()}@example.org`,
      password: PASSWORD,
      displayName: `${first} ${last}`,
      unit: `${1 + (i % 40)}${['A', 'B', 'C'][i % 3]}`,
      inviteCode: config.inviteCode,
    });
  });

  // Without ADMIN_EMAILS set there would be nobody who can run maintenance by
  // hand or check the ledger, which makes a fresh dev database awkward.
  if (config.adminEmails.length === 0 && members[0]) {
    db.prepare('UPDATE members SET is_admin = 1 WHERE id = ?').run(members[0].id);
  }

  // Everyone starts with enough USDC to cover a couple of deposits.
  members.forEach((member, i) => {
    topUp(db, member.id, usdcToMicros(400 + i * 25), `seed-topup-${member.id}`, now - 120 * DAY_MS);
  });

  const tools = TOOLS.map((spec, i) => {
    const owner = members[i % members.length]!;
    return createTool(db, {
      ownerId: owner.id,
      name: spec.name,
      category: spec.category,
      description: `Shared by ${owner.display_name}. Message before collecting.`,
      conditionNotes: spec.condition,
      depositMicros: usdcToMicros(spec.deposit),
      lateFeeMicros: usdcToMicros(spec.lateFee),
      maxLoanDays: spec.days,
      photoKey: null,
    });
  });

  // Build each member's track record out of real, fully settled loans.
  let cursor = now - 110 * DAY_MS;
  members.forEach((borrower, i) => {
    const history = HISTORIES[i % HISTORIES.length]!;
    const outcomes = [
      ...Array.from({ length: history.onTime }, () => 0),
      ...history.lateBy,
    ].sort(() => random() - 0.5);

    for (const lateBy of outcomes) {
      const tool = pickAvailableTool(db, borrower.id, random());
      if (!tool) continue;
      const requestedAt = cursor;
      const days = Math.max(1, Math.min(tool.max_loan_days, 1 + Math.floor(random() * tool.max_loan_days)));
      const loan = requestLoan(db, {
        toolId: tool.id,
        borrowerId: borrower.id,
        days,
        message: 'Weekend project - will take good care of it.',
        now: requestedAt,
      });
      approveLoan(db, loan.id, tool.owner_id, requestedAt + 2 * HOUR_MS);
      handOver(db, loan.id, tool.owner_id, requestedAt + 6 * HOUR_MS);
      const dueAt = requestedAt + 6 * HOUR_MS + days * DAY_MS;
      const returnedAt = lateBy === 0 ? dueAt - 3 * HOUR_MS : dueAt + lateBy * DAY_MS - HOUR_MS;
      confirmReturn(db, loan.id, tool.owner_id, returnedAt);
      cursor += 2 * DAY_MS;
      if (cursor > now - 10 * DAY_MS) cursor = now - 110 * DAY_MS;
    }
  });

  // Live state to land on: one healthy loan, one overdue loan racking up fees,
  // and a pending request waiting on its owner.
  const reserved = new Set<string>();
  const overdueTool = pickAvailableTool(db, members[7]!.id, 0.1)!;
  reserved.add(overdueTool.id);
  const overdueLoan = requestLoan(db, {
    toolId: overdueTool.id,
    borrowerId: members[7]!.id,
    days: 2,
    message: 'Fixing the back fence.',
    now: now - 9 * DAY_MS,
  });
  approveLoan(db, overdueLoan.id, overdueTool.owner_id, now - 9 * DAY_MS + HOUR_MS);
  handOver(db, overdueLoan.id, overdueTool.owner_id, now - 9 * DAY_MS + 2 * HOUR_MS);

  const healthyTool = pickAvailableTool(db, members[1]!.id, 0.4, reserved)!;
  reserved.add(healthyTool.id);
  const healthyLoan = requestLoan(db, {
    toolId: healthyTool.id,
    borrowerId: members[1]!.id,
    days: Math.max(2, healthyTool.max_loan_days),
    message: 'Hanging shelves on Saturday.',
    now: now - 12 * HOUR_MS,
  });
  approveLoan(db, healthyLoan.id, healthyTool.owner_id, now - 11 * HOUR_MS);
  handOver(db, healthyLoan.id, healthyTool.owner_id, now - 10 * HOUR_MS);

  const requestedTool = pickAvailableTool(db, members[3]!.id, 0.7, reserved)!;
  requestLoan(db, {
    toolId: requestedTool.id,
    borrowerId: members[3]!.id,
    days: 1,
    message: 'Just need it for an afternoon.',
    now: now - 4 * HOUR_MS,
  });

  return { members: members.length, tools: tools.length, admin: members[0]!.email };
}

function main() {
  const db = openDb(config.databaseUrl);
  const existing = (db.prepare('SELECT COUNT(*) AS n FROM members').get() as { n: number }).n;
  if (existing > 0) {
    if (process.env.SEED_RESET !== '1') {
      console.error(
        `Refusing to seed: ${existing} members already exist in ${config.databaseUrl}.\n` +
          'Re-run with SEED_RESET=1 to wipe and reseed.',
      );
      process.exit(1);
    }
    db.exec('DELETE FROM ledger_entries; DELETE FROM transfers; DELETE FROM loans; DELETE FROM tools; DELETE FROM sessions; DELETE FROM members;');
  }
  const summary = seed(db);
  const late = db
    .prepare(`SELECT COUNT(*) AS n FROM loans WHERE status = 'returned' AND late_days > 0`)
    .get() as { n: number };
  const loans = (db.prepare('SELECT COUNT(*) AS n FROM loans').get() as { n: number }).n;
  console.log(
    `Seeded ${summary.members} members, ${summary.tools} tools, ${loans} loans (${late.n} returned late).\n` +
      `Sign in as any member with the password: ${PASSWORD}\n` +
      `Admin account: ${summary.admin}`,
  );
  db.close();
}

main();
