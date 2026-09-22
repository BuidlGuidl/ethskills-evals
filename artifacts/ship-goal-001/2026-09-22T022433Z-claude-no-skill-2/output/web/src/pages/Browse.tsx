import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { categoryLabel, usdc } from '../lib/format.js';
import type { Tool } from '../lib/types.js';
import { Empty, ErrorNote, Spinner } from '../components/Bits.js';
import { TrustBadge } from '../components/TrustBadge.js';

const SORTS = [
  { key: 'trust', label: 'Owner track record' },
  { key: 'newest', label: 'Newest' },
  { key: 'deposit', label: 'Lowest deposit' },
];

export function Browse() {
  const [tools, setTools] = useState<Tool[] | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [sort, setSort] = useState('trust');
  const [category, setCategory] = useState('');
  const [availableOnly, setAvailableOnly] = useState(true);
  const [query, setQuery] = useState('');
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    api.categories().then(setCategories).catch(setError);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setTools(null);
    // Debounced so typing in the search box does not hammer the API.
    const timer = setTimeout(() => {
      api
        .browse({ sort, q: query || undefined, category: category || undefined, availableOnly })
        .then((res) => {
          if (!cancelled) setTools(res.items);
        })
        .catch((err) => !cancelled && setError(err));
    }, query ? 200 : 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [sort, query, category, availableOnly]);

  return (
    <section>
      <div className="page-head">
        <div>
          <h1>Browse the shed</h1>
          <p className="muted">
            Sorted by the owner's track record by default, so the members who look after the library come
            first.
          </p>
        </div>
        <Link className="primary" to="/tools/new">
          List a tool
        </Link>
      </div>

      <div className="filters">
        <input
          type="search"
          placeholder="Search tools…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All categories</option>
          {categories.map((key) => (
            <option key={key} value={key}>
              {categoryLabel(key)}
            </option>
          ))}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value)}>
          {SORTS.map((option) => (
            <option key={option.key} value={option.key}>
              Sort: {option.label}
            </option>
          ))}
        </select>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={availableOnly}
            onChange={(e) => setAvailableOnly(e.target.checked)}
          />
          Available now
        </label>
      </div>

      <ErrorNote error={error} />
      {tools === null ? (
        <Spinner label="Loading tools…" />
      ) : tools.length === 0 ? (
        <Empty>
          Nothing matches that yet. <Link to="/tools/new">List the first one?</Link>
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
                  {tool.status === 'lent_out' && <span className="pill pill-active">out on loan</span>}
                </div>
                {tool.conditionNotes && <p className="condition">{tool.conditionNotes}</p>}
                <dl className="terms">
                  <div>
                    <dt>Deposit</dt>
                    <dd>{usdc(tool.deposit)}</dd>
                  </div>
                  <div>
                    <dt>Late fee</dt>
                    <dd>{usdc(tool.lateFeePerDay)}/day</dd>
                  </div>
                  <div>
                    <dt>Up to</dt>
                    <dd>{tool.maxLoanDays} days</dd>
                  </div>
                </dl>
                {tool.owner && (
                  <div className="owner-line">
                    <Link to={`/members/${tool.owner.id}`}>{tool.owner.displayName}</Link>
                    <TrustBadge reputation={tool.owner.reputation} />
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
