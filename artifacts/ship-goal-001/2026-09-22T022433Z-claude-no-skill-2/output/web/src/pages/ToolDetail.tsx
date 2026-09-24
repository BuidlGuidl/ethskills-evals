import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useSession } from '../lib/session.js';
import { categoryLabel, dateTime, relativeDays, usdc } from '../lib/format.js';
import type { Loan, PublicMember, Tool } from '../lib/types.js';
import { ErrorNote, Field, Spinner, StatusPill } from '../components/Bits.js';
import { TrustBadge } from '../components/TrustBadge.js';

interface ToolView {
  tool: Tool;
  owner: PublicMember;
  activeLoan: Loan | null;
  requests?: (Loan & { borrower: PublicMember })[];
}

export function ToolDetail() {
  const { id = '' } = useParams();
  const { member, refresh: refreshSession } = useSession();
  const [view, setView] = useState<ToolView | null>(null);
  const [days, setDays] = useState(1);
  const [message, setMessage] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const next = await api.tool(id);
      setView(next);
      setDays((current) => Math.min(current, next.tool.maxLoanDays) || 1);
    } catch (err) {
      setError(err);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!view) return error ? <ErrorNote error={error} /> : <Spinner />;
  const { tool, owner, activeLoan, requests } = view;
  const isOwner = member?.id === owner.id;
  const totalIfLate = tool.lateFeePerDay.micros;

  async function act(run: () => Promise<unknown>, done: string) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await run();
      await Promise.all([load(), refreshSession()]);
      setNotice(done);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="detail">
      <div className="detail-photo card">
        {tool.photoUrl ? (
          <img src={tool.photoUrl} alt={tool.name} />
        ) : (
          <span className="photo-placeholder">{categoryLabel(tool.category)}</span>
        )}
      </div>

      <div className="detail-main">
        <h1>{tool.name}</h1>
        <p className="muted">
          {categoryLabel(tool.category)} · listed {dateTime(tool.createdAt)} ·{' '}
          <StatusPill status={tool.status === 'lent_out' ? 'out on loan' : tool.status} />
        </p>

        {tool.description && <p>{tool.description}</p>}
        {tool.conditionNotes && (
          <div className="card condition-card">
            <h3>Condition notes from the owner</h3>
            <p>{tool.conditionNotes}</p>
          </div>
        )}

        <dl className="terms terms-wide">
          <div>
            <dt>Deposit (refundable)</dt>
            <dd>{usdc(tool.deposit)}</dd>
          </div>
          <div>
            <dt>Late fee</dt>
            <dd>{usdc(tool.lateFeePerDay)} per day</dd>
          </div>
          <div>
            <dt>Maximum loan</dt>
            <dd>{tool.maxLoanDays} days</dd>
          </div>
        </dl>

        <div className="owner-block card">
          <div>
            <span className="muted">Owned by</span>
            <Link className="owner-name" to={`/members/${owner.id}`}>
              {owner.displayName}
            </Link>
            {owner.unit && <span className="muted"> · unit {owner.unit}</span>}
          </div>
          <TrustBadge reputation={owner.reputation} detailed />
        </div>

        <ErrorNote error={error} />
        {notice && <p className="notice">{notice}</p>}

        {!isOwner && tool.status === 'available' && (
          <form
            className="card request-form"
            onSubmit={(event) => {
              event.preventDefault();
              void act(
                () => api.requestLoan({ toolId: tool.id, days, message: message || undefined }),
                'Request sent. Your deposit is held until the owner answers.',
              );
            }}
          >
            <h3>Ask to borrow</h3>
            <Field label="How many days?" hint={`Up to ${tool.maxLoanDays}.`}>
              <input
                type="number"
                min={1}
                max={tool.maxLoanDays}
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
              />
            </Field>
            <Field label="Message to the owner" hint="Optional — what you need it for.">
              <textarea rows={2} value={message} onChange={(e) => setMessage(e.target.value)} />
            </Field>
            <p className="muted small">
              {usdc(tool.deposit)} moves into escrow when you ask, and comes back when the owner marks the
              tool returned. Every day late costs {usdc(totalIfLate)} out of that deposit.
            </p>
            <button className="primary" type="submit" disabled={busy}>
              Request for {days} {days === 1 ? 'day' : 'days'}
            </button>
          </form>
        )}

        {!isOwner && tool.status === 'lent_out' && (
          <p className="notice">
            Out on loan{activeLoan?.dueAt ? `, due back ${relativeDays(activeLoan.dueAt)}` : ''}. Check back
            then.
          </p>
        )}

        {isOwner && activeLoan && (
          <div className="card">
            <h3>Currently with a borrower</h3>
            <p>
              <Link to="/loans">Manage this loan</Link> · due {relativeDays(activeLoan.dueAt)}
            </p>
          </div>
        )}

        {isOwner && requests && requests.length > 0 && (
          <div className="card">
            <h3>Requests waiting on you</h3>
            <p className="muted small">Listed best track record first.</p>
            <ul className="request-list">
              {[...requests]
                .sort((a, b) => (b.borrower.reputation?.score ?? 0) - (a.borrower.reputation?.score ?? 0))
                .map((request) => (
                  <li key={request.id}>
                    <div>
                      <Link to={`/members/${request.borrower.id}`}>{request.borrower.displayName}</Link>
                      <TrustBadge reputation={request.borrower.reputation} />
                      <p className="muted small">
                        {request.requestedDays} {request.requestedDays === 1 ? 'day' : 'days'}
                        {request.message ? ` — “${request.message}”` : ''}
                      </p>
                    </div>
                    <div className="row-actions">
                      <button
                        className="primary"
                        disabled={busy}
                        onClick={() => void act(() => api.loanAction(request.id, 'approve'), 'Approved.')}
                      >
                        Approve
                      </button>
                      <button
                        disabled={busy}
                        onClick={() => void act(() => api.loanAction(request.id, 'decline'), 'Declined.')}
                      >
                        Decline
                      </button>
                    </div>
                  </li>
                ))}
            </ul>
          </div>
        )}

        {isOwner && (!requests || requests.length === 0) && tool.status === 'available' && (
          <p className="muted">No requests yet. It shows up in browse for everyone else.</p>
        )}
      </div>
    </section>
  );
}
