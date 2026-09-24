import { config } from '../config.js';
import { today as todayIn, daysBetween, formatDay } from '../domain/dates.js';
import { formatUsdc } from '../domain/money.js';
import { projectedSettlement } from '../domain/fees.js';
import { expireStaleRequests, overdueLoans } from '../services/loans.js';
import { notify } from '../services/notices.js';
import { purgeExpiredSessions } from '../services/members.js';

// Housekeeping that has to happen even when nobody opens the site.
//
// Note what this job does *not* do: it does not accrue late fees. The fee for
// a loan is always computed from its due date and the day it came back, so it
// is correct whether or not this job ran, ran twice, or ran three days late.
// The job only nudges people and tidies up -- which is the only kind of
// scheduled work that is safe to miss.

export function runDailyJob(handle, escrow, now = new Date()) {
  const today = todayIn(config.timezone, now);
  const expired = expireStaleRequests(handle, escrow, now);
  const sessions = purgeExpiredSessions(handle);

  let reminded = 0;
  for (const loan of overdueLoans(handle, now)) {
    const late = daysBetween(loan.due_day, today);
    const projection = projectedSettlement(loan, today);
    notify(handle, {
      memberId: loan.borrower_id,
      loanId: loan.id,
      kind: 'overdue_borrower',
      body: `${loan.tool_name} was due back ${formatDay(loan.due_day)} — ${late} day${late === 1 ? '' : 's'} ago. ${formatUsdc(projection.fee)} USDC of your deposit has gone to ${loan.owner_name} so far${projection.forfeited ? ', which is all of it' : `, and it grows by ${formatUsdc(loan.dailyLateFee)} a day`}.`,
    });
    notify(handle, {
      memberId: loan.owner_id,
      loanId: loan.id,
      kind: 'overdue_owner',
      body: `${loan.borrower_name} still has your ${loan.tool_name}, ${late} day${late === 1 ? '' : 's'} past due. ${formatUsdc(projection.fee)} USDC in late fees is set aside for you; confirm the return when you have it back.`,
    });
    reminded += 1;
  }
  return { today, expiredRequests: expired, overdueReminders: reminded, sessionsPurged: sessions };
}
