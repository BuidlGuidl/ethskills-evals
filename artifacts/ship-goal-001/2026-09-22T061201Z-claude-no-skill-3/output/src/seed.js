// Demo data, so a developer can open the site and see a shed that already has
// a history in it: on-time borrowers, a chronically late one, a tool that is
// out and overdue right now, and a request waiting to be decided.
//
//   npm run seed          -- fills an empty database
//   npm run seed -- --force  -- wipes it first
//
// Every loan below is created through the real service functions with the
// clock moved back, so the ledger and the track records are what the
// application would actually have produced.

import { config } from './config.js';
import { db, transaction } from './db.js';
import { addDays, today as todayIn } from './domain/dates.js';
import { parseUsdc } from './domain/money.js';
import { ensureSystemAccounts } from './payments/ledger.js';
import { LedgerEscrow, fund } from './payments/escrow.js';
import { createMember } from './services/members.js';
import { listTool } from './services/tools.js';
import { approveLoan, confirmReturn, requestLoan } from './services/loans.js';

const handle = db();
const escrow = new LedgerEscrow();
const force = process.argv.includes('--force');
const today = todayIn(config.timezone);
const day = (offset) => addDays(today, offset);
const at = (offset) => new Date(`${day(offset)}T15:00:00Z`);

const existing = handle.prepare('SELECT COUNT(*) AS n FROM members').get().n;
if (existing > 0 && !force) {
  console.log(`${config.databasePath} already has ${existing} members. Re-run with --force to wipe and reseed.`);
  process.exit(0);
}
if (force) {
  transaction(handle, () => {
    for (const table of ['notices', 'escrow_holds', 'ledger_entries', 'ledger_accounts', 'loans', 'tools', 'sessions', 'members']) {
      handle.exec(`DELETE FROM ${table}`);
    }
  });
}
ensureSystemAccounts(handle);

const password = 'toolshed-demo-1';
const people = [
  { name: 'Ada Whitlow', email: 'ada@example.org', unit: '4A', isAdmin: true },
  { name: 'Ben Okafor', email: 'ben@example.org', unit: '11C' },
  { name: 'Carmen Ruiz', email: 'carmen@example.org', unit: '2B' },
  { name: 'Dev Patel', email: 'dev@example.org', unit: '9F' },
  { name: 'Erin Shah', email: 'erin@example.org', unit: '7D' },
];

const members = {};
for (const person of people) {
  const member = createMember(handle, { ...person, password });
  members[person.name.split(' ')[0].toLowerCase()] = member;
  fund(handle, member.id, parseUsdc('250'), 'opening balance');
}

const tools = {
  drill: listTool(handle, members.ada.id, {
    name: 'Cordless drill, 18V',
    description: 'Makita with two batteries and a bit set. Charger included.',
    conditionNotes: 'Chuck sticks if you overtighten it. The second battery holds about half a charge.',
    deposit: '60',
    dailyLateFee: '3',
    maxDays: 5,
  }),
  ladder: listTool(handle, members.ada.id, {
    name: 'Extension ladder, 24ft',
    description: 'Aluminium, stands on the side path. Needs a car with a roof rack.',
    conditionNotes: 'Foot pad on the left leg is worn. Fine on grass, slides a bit on wet tile.',
    deposit: '120',
    dailyLateFee: '6',
    maxDays: 3,
  }),
  mower: listTool(handle, members.ben.id, {
    name: 'Electric lawn mower',
    description: 'Corded, 40ft cable on the handle.',
    conditionNotes: 'Blade sharpened last spring. Grass box latch needs a firm push.',
    deposit: '80',
    dailyLateFee: '4',
    maxDays: 4,
  }),
  sander: listTool(handle, members.carmen.id, {
    name: 'Orbital sander',
    description: 'With a pack of 80/120/220 grit discs. Take what you need.',
    conditionNotes: 'Dust bag zip is broken — wear a mask or hook it to a vacuum.',
    deposit: '35',
    dailyLateFee: '2',
    maxDays: 7,
  }),
  wheelbarrow: listTool(handle, members.dev.id, {
    name: 'Wheelbarrow',
    description: 'Steel tray, pneumatic tyre. Pump hangs next to it.',
    conditionNotes: 'Tyre goes soft after about a week.',
    deposit: '25',
    dailyLateFee: '1',
    maxDays: 14,
  }),
};

/** A whole loan, start to finish, as of `startOffset` days ago. */
function pastLoan({ tool, borrower, startOffset, days, returnedOffset }) {
  const start = day(startOffset);
  const due = addDays(start, days - 1);
  const loan = requestLoan(
    handle,
    escrow,
    { toolId: tool.id, borrowerId: borrower.id, startDay: start, dueDay: due, note: '' },
    at(startOffset),
  );
  approveLoan(handle, escrow, loan.id, tool.owner_id);
  confirmReturn(handle, escrow, loan.id, tool.owner_id, day(returnedOffset), at(returnedOffset));
}

// Carmen and Dev are reliable. Erin is not. Ben is new to borrowing.
pastLoan({ tool: tools.drill, borrower: members.carmen, startOffset: -60, days: 3, returnedOffset: -58 });
pastLoan({ tool: tools.ladder, borrower: members.carmen, startOffset: -40, days: 2, returnedOffset: -39 });
pastLoan({ tool: tools.mower, borrower: members.carmen, startOffset: -25, days: 2, returnedOffset: -24 });
pastLoan({ tool: tools.wheelbarrow, borrower: members.carmen, startOffset: -12, days: 3, returnedOffset: -10 });

pastLoan({ tool: tools.sander, borrower: members.dev, startOffset: -52, days: 4, returnedOffset: -49 });
pastLoan({ tool: tools.drill, borrower: members.dev, startOffset: -30, days: 2, returnedOffset: -29 });
pastLoan({ tool: tools.mower, borrower: members.dev, startOffset: -15, days: 2, returnedOffset: -13 });

pastLoan({ tool: tools.drill, borrower: members.erin, startOffset: -70, days: 3, returnedOffset: -63 }); // 5 days late
pastLoan({ tool: tools.sander, borrower: members.erin, startOffset: -45, days: 5, returnedOffset: -39 }); // 2 days late
pastLoan({ tool: tools.wheelbarrow, borrower: members.erin, startOffset: -20, days: 4, returnedOffset: -17 }); // on time

pastLoan({ tool: tools.sander, borrower: members.ben, startOffset: -8, days: 3, returnedOffset: -6 });

// Out right now, and overdue: Erin has Ada's ladder, four days past due.
const overdue = requestLoan(
  handle,
  escrow,
  { toolId: tools.ladder.id, borrowerId: members.erin.id, startDay: day(-6), dueDay: day(-4), note: 'Gutters.' },
  at(-6),
);
approveLoan(handle, escrow, overdue.id, tools.ladder.owner_id);

// Waiting on Ada to decide: two people want the drill this weekend.
requestLoan(handle, escrow, {
  toolId: tools.drill.id,
  borrowerId: members.carmen.id,
  startDay: day(1),
  dueDay: day(3),
  note: 'Putting up shelves in the hall.',
});
requestLoan(handle, escrow, {
  toolId: tools.drill.id,
  borrowerId: members.erin.id,
  startDay: day(1),
  dueDay: day(2),
  note: 'Same weekend, sorry!',
});

console.log(`Seeded ${config.databasePath}`);
console.log('Sign in as any of:');
for (const person of people) console.log(`  ${person.email} / ${password}${person.isAdmin ? '  (treasurer)' : ''}`);
handle.close();
