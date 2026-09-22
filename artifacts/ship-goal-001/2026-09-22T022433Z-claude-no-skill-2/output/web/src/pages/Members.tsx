import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import type { PublicMember } from '../lib/types.js';
import { ErrorNote, Spinner } from '../components/Bits.js';
import { TrustBadge } from '../components/TrustBadge.js';

/** The roster, ranked the same way browse ranks owners. */
export function Members() {
  const [members, setMembers] = useState<PublicMember[] | null>(null);
  const [query, setQuery] = useState('');
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      api
        .members(query || undefined)
        .then((rows) => !cancelled && setMembers(rows))
        .catch((err) => !cancelled && setError(err));
    }, query ? 200 : 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  return (
    <section>
      <h1>Members</h1>
      <p className="muted">Ranked by borrowing track record — the same ordering browse uses for owners.</p>
      <div className="filters">
        <input
          type="search"
          placeholder="Search by name…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <ErrorNote error={error} />
      {!members ? (
        <Spinner />
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Member</th>
              <th>Track record</th>
              <th className="right">Loans</th>
              <th className="right">Late</th>
              <th className="right">Lent out</th>
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr key={member.id}>
                <td>
                  <Link to={`/members/${member.id}`}>{member.displayName}</Link>
                  {member.unit && <span className="muted"> · {member.unit}</span>}
                </td>
                <td>
                  <TrustBadge reputation={member.reputation} />
                </td>
                <td className="right">{member.reputation?.loansBorrowed ?? 0}</td>
                <td className="right">{member.reputation?.lateReturns ?? 0}</td>
                <td className="right">{member.reputation?.loansLent ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
