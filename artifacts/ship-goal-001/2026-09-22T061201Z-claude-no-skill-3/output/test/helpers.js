import { open } from '../src/db.js';
import { ensureSystemAccounts } from '../src/payments/ledger.js';
import { LedgerEscrow, fund } from '../src/payments/escrow.js';
import { createMember } from '../src/services/members.js';
import { listTool } from '../src/services/tools.js';
import { parseUsdc } from '../src/domain/money.js';

/** A fresh in-memory Toolshed, with as many funded members as asked for. */
export function fixture({ members = ['Owner', 'Borrower'], funding = '500' } = {}) {
  const handle = open(':memory:');
  ensureSystemAccounts(handle);
  const escrow = new LedgerEscrow();
  const people = members.map((name, index) => {
    const member = createMember(handle, {
      name,
      email: `${name.toLowerCase()}${index}@example.org`,
      password: 'password-1234',
    });
    if (funding) fund(handle, member.id, parseUsdc(funding), 'test');
    return member;
  });
  return { handle, escrow, members: people };
}

export function tool(handle, ownerId, overrides = {}) {
  return listTool(handle, ownerId, {
    name: 'Cordless drill',
    description: 'test',
    conditionNotes: 'fine',
    deposit: '60',
    dailyLateFee: '3',
    maxDays: 7,
    ...overrides,
  });
}

/** A bare loan row to hang an escrow hold on, without going through the flow. */
export function loanRow(handle, { toolId, borrowerId, ownerId, id = 1 }) {
  handle
    .prepare(
      `INSERT INTO loans (id, tool_id, borrower_id, owner_id, status, start_day, due_day,
                          deposit_amount, daily_late_fee, requested_at)
       VALUES (?, ?, ?, ?, 'requested', '2026-01-01', '2026-01-03', '0', '0', '')`,
    )
    .run(id, toolId, borrowerId, ownerId);
  return id;
}
