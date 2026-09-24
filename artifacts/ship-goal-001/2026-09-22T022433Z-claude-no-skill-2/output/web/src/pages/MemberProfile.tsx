import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useSession } from '../lib/session.js';
import { categoryLabel, usdc } from '../lib/format.js';
import type { PublicMember, Tool } from '../lib/types.js';
import { Empty, ErrorNote, Spinner } from '../components/Bits.js';
import { TrustBadge } from '../components/TrustBadge.js';

export function MemberProfile() {
  const { id = '' } = useParams();
  const { member: me } = useSession();
  const [data, setData] = useState<{ member: PublicMember; tools: Tool[] } | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [maintenance, setMaintenance] = useState<string | null>(null);

  useEffect(() => {
    setData(null);
    api.member(id).then(setData).catch(setError);
  }, [id]);

  if (!data) return error ? <ErrorNote error={error} /> : <Spinner />;
  const { member, tools } = data;
  const rep = member.reputation;
  const isMe = me?.id === member.id;

  return (
    <section>
      <div className="page-head">
        <div>
          <h1>{member.displayName}</h1>
          <p className="muted">
            {member.unit ? `Unit ${member.unit} · ` : ''}member since{' '}
            {member.memberSince ? new Date(member.memberSince).toLocaleDateString() : '—'}
          </p>
          <TrustBadge reputation={rep} detailed />
        </div>
      </div>

      {rep && (
        <div className="balances">
          <div className="card stat">
            <span className="stat-label">Loans borrowed</span>
            <span className="stat-value">{rep.loansBorrowed}</span>
            <span className="muted small">{rep.activeLoans} out right now</span>
          </div>
          <div className="card stat">
            <span className="stat-label">Returned late</span>
            <span className="stat-value">{rep.lateReturns}</span>
            <span className="muted small">{rep.lateDays} late days in total</span>
          </div>
          <div className="card stat">
            <span className="stat-label">On-time rate</span>
            <span className="stat-value">
              {rep.onTimeRate === null ? '—' : `${Math.round(rep.onTimeRate * 100)}%`}
            </span>
            <span className="muted small">Track record score {rep.score}/100</span>
          </div>
          <div className="card stat">
            <span className="stat-label">Tools lent out</span>
            <span className="stat-value">{rep.loansLent}</span>
            <span className="muted small">{tools.length} listed</span>
          </div>
        </div>
      )}

      <h2>{isMe ? 'Your listings' : 'Their listings'}</h2>
      {tools.length === 0 ? (
        <Empty>
          Nothing listed yet.{isMe && <> <Link to="/tools/new">List a tool</Link>.</>}
        </Empty>
      ) : (
        <ul className="grid">
          {tools.map((tool) => (
            <li key={tool.id} className="card tool-card">
              <Link to={`/tools/${tool.id}`} className="tool-photo">
                {tool.photoUrl ? (
                  <img src={tool.photoUrl} alt={tool.name} loading="lazy" />
                ) : (
                  <span className="photo-placeholder">{categoryLabel(tool.category)}</span>
                )}
              </Link>
              <div className="tool-body">
                <div className="tool-title">
                  <Link to={`/tools/${tool.id}`}>{tool.name}</Link>
                  {tool.status !== 'available' && <span className="pill pill-active">{tool.status}</span>}
                </div>
                <p className="muted small">
                  {usdc(tool.deposit)} deposit · {usdc(tool.lateFeePerDay)}/day late
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {isMe && me?.isAdmin && (
        <div className="card">
          <h3>Admin</h3>
          <p className="muted small">
            The server sweeps late fees on a timer. This runs the same sweep now — handy after downtime.
          </p>
          <button
            onClick={async () => {
              const result = await api.runMaintenance();
              setMaintenance(
                `Charged ${result.accrual.charged.usdc} USDC across ${result.accrual.loansCharged} loan(s); ` +
                  `expired ${result.expiredRequests} stale request(s).`,
              );
            }}
          >
            Run maintenance sweep
          </button>
          {maintenance && <p className="notice">{maintenance}</p>}
        </div>
      )}
    </section>
  );
}
