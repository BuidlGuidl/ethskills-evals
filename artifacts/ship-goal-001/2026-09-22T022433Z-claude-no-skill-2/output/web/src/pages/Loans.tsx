import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useSession } from '../lib/session.js';
import { dateTime, relativeDays, usdc } from '../lib/format.js';
import type { Loan } from '../lib/types.js';
import { Empty, ErrorNote, Spinner, StatusPill } from '../components/Bits.js';
import { TrustBadge } from '../components/TrustBadge.js';

const OPEN: Loan['status'][] = ['requested', 'approved', 'active'];

export function Loans() {
  const { member, refresh: refreshSession } = useSession();
  const [loans, setLoans] = useState<Loan[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoans(await api.loans({ role: 'any' }));
    } catch (err) {
      setError(err);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(loanId: string, action: 'approve' | 'decline' | 'cancel' | 'handover' | 'return') {
    setBusy(loanId);
    setError(null);
    try {
      await api.loanAction(loanId, action);
      await Promise.all([load(), refreshSession()]);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(null);
    }
  }

  if (!loans) return error ? <ErrorNote error={error} /> : <Spinner />;

  const lending = loans.filter((loan) => loan.ownerId === member?.id);
  const borrowing = loans.filter((loan) => loan.borrowerId === member?.id);
  const incoming = lending.filter((loan) => loan.status === 'requested');

  // Owners decide who to lend to: the queue is ranked by track record.
  incoming.sort((a, b) => (b.borrower?.reputation?.score ?? 0) - (a.borrower?.reputation?.score ?? 0));

  return (
    <section>
      <h1>Loans</h1>
      <ErrorNote error={error} />

      <h2>Requests waiting on you</h2>
      {incoming.length === 0 ? (
        <Empty>Nothing to decide right now.</Empty>
      ) : (
        <ul className="loan-list">
          {incoming.map((loan) => (
            <li key={loan.id} className="card loan-row">
              <div className="loan-main">
                <strong>{loan.tool?.name}</strong>
                <p className="muted small">
                  <Link to={`/members/${loan.borrowerId}`}>{loan.borrower?.displayName}</Link> wants it for{' '}
                  {loan.requestedDays} {loan.requestedDays === 1 ? 'day' : 'days'}
                  {loan.message ? ` — “${loan.message}”` : ''}
                </p>
                <TrustBadge reputation={loan.borrower?.reputation} detailed />
              </div>
              <div className="row-actions">
                <button className="primary" disabled={busy === loan.id} onClick={() => void act(loan.id, 'approve')}>
                  Approve
                </button>
                <button disabled={busy === loan.id} onClick={() => void act(loan.id, 'decline')}>
                  Decline
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <h2>Tools you have lent out</h2>
      <LoanTable
        loans={lending.filter((loan) => loan.status !== 'requested')}
        emptyText="Nothing of yours is out at the moment."
        renderActions={(loan) =>
          loan.status === 'approved' ? (
            <>
              <button className="primary" disabled={busy === loan.id} onClick={() => void act(loan.id, 'handover')}>
                Mark handed over
              </button>
              <button disabled={busy === loan.id} onClick={() => void act(loan.id, 'decline')}>
                Pickup never happened
              </button>
            </>
          ) : loan.status === 'active' ? (
            <button className="primary" disabled={busy === loan.id} onClick={() => void act(loan.id, 'return')}>
              Mark returned
            </button>
          ) : null
        }
        counterparty={(loan) => loan.borrower?.displayName ?? '—'}
      />

      <h2>Tools you have borrowed</h2>
      <LoanTable
        loans={borrowing}
        emptyText="You have not borrowed anything yet."
        renderActions={(loan) =>
          loan.status === 'requested' || loan.status === 'approved' ? (
            <button disabled={busy === loan.id} onClick={() => void act(loan.id, 'cancel')}>
              Cancel
            </button>
          ) : null
        }
        counterparty={(loan) => loan.owner?.displayName ?? '—'}
      />
    </section>
  );
}

function LoanTable({
  loans,
  emptyText,
  renderActions,
  counterparty,
}: {
  loans: Loan[];
  emptyText: string;
  renderActions: (loan: Loan) => React.ReactNode;
  counterparty: (loan: Loan) => string;
}) {
  const open = loans.filter((loan) => OPEN.includes(loan.status));
  const past = loans.filter((loan) => !OPEN.includes(loan.status));

  if (loans.length === 0) return <Empty>{emptyText}</Empty>;

  return (
    <>
      <ul className="loan-list">
        {open.map((loan) => (
          <li key={loan.id} className={loan.overdue ? 'card loan-row overdue' : 'card loan-row'}>
            <div className="loan-main">
              <strong>
                <Link to={`/tools/${loan.toolId}`}>{loan.tool?.name}</Link>
              </strong>{' '}
              <StatusPill status={loan.status} overdue={loan.overdue} />
              <p className="muted small">
                with {counterparty(loan)} · deposit {usdc(loan.deposit)} · late fee{' '}
                {usdc(loan.lateFeePerDay)}/day
              </p>
              {loan.status === 'active' && (
                <p className={loan.overdue ? 'error small' : 'small'}>
                  Due {relativeDays(loan.dueAt)} ({dateTime(loan.dueAt)})
                  {loan.lateFeesCharged.micros > 0 &&
                    ` · ${usdc(loan.lateFeesCharged)} in late fees so far, ${usdc(
                      loan.depositRemaining,
                    )} of the deposit left`}
                  {loan.depositExhausted && ' · deposit used up — the association will follow up'}
                </p>
              )}
              {loan.status === 'approved' && (
                <p className="small">Approved — arrange the handover, then the owner starts the clock.</p>
              )}
            </div>
            <div className="row-actions">{renderActions(loan)}</div>
          </li>
        ))}
      </ul>

      {past.length > 0 && (
        <details className="history">
          <summary>{past.length} finished</summary>
          <table className="table">
            <thead>
              <tr>
                <th>Tool</th>
                <th>With</th>
                <th>Outcome</th>
                <th>Late fees</th>
                <th>Returned</th>
              </tr>
            </thead>
            <tbody>
              {past.map((loan) => (
                <tr key={loan.id}>
                  <td>
                    <Link to={`/tools/${loan.toolId}`}>{loan.tool?.name}</Link>
                  </td>
                  <td>{counterparty(loan)}</td>
                  <td>
                    {loan.status === 'returned'
                      ? loan.lateDays > 0
                        ? `${loan.lateDays} ${loan.lateDays === 1 ? 'day' : 'days'} late`
                        : 'on time'
                      : loan.status}
                    {loan.declineReason ? ` — ${loan.declineReason}` : ''}
                  </td>
                  <td>{loan.lateFeesCharged.micros > 0 ? usdc(loan.lateFeesCharged) : '—'}</td>
                  <td>{dateTime(loan.returnedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </>
  );
}
