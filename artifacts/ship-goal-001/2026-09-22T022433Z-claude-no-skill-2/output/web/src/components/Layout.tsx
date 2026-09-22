import { Link, NavLink, useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useSession } from '../lib/session.js';
import { usdc } from '../lib/format.js';
import { TrustBadge } from './TrustBadge.js';

export function Layout({ children }: { children: ReactNode }) {
  const { member, signOut } = useSession();
  const navigate = useNavigate();

  return (
    <div className="shell">
      <header className="topbar">
        <Link to="/" className="brand">
          <span className="brand-mark" aria-hidden="true" />
          Toolshed
        </Link>
        <nav className="nav">
          <NavLink to="/" end>
            Browse
          </NavLink>
          <NavLink to="/loans">Loans</NavLink>
          <NavLink to="/tools/new">List a tool</NavLink>
          <NavLink to="/members">Members</NavLink>
          <NavLink to="/wallet">Wallet</NavLink>
        </nav>
        {member && (
          <div className="me">
            <div className="me-meta">
              <Link to={`/members/${member.id}`} className="me-name">
                {member.displayName}
              </Link>
              <TrustBadge reputation={member.reputation} />
            </div>
            <div className="me-balance" title="Available / held in escrow">
              {usdc(member.balances.available)}
              {member.balances.escrow.micros > 0 && (
                <span className="held">+{usdc(member.balances.escrow)} held</span>
              )}
            </div>
            <button
              type="button"
              className="link-button"
              onClick={async () => {
                await signOut();
                navigate('/login');
              }}
            >
              Sign out
            </button>
          </div>
        )}
      </header>
      <main className="content">{children}</main>
      <footer className="footer">
        Toolshed v0.1 — deposits and late fees settle in USDC. Late fees are charged per day past the due date.
      </footer>
    </div>
  );
}
