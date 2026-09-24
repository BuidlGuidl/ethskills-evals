import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { useSession } from '../lib/session.js';
import { dateTime, usdc } from '../lib/format.js';
import type { WalletView } from '../lib/types.js';
import { ErrorNote, Field, Spinner } from '../components/Bits.js';

const KIND_LABELS: Record<string, string> = {
  top_up: 'Top-up',
  withdrawal: 'Withdrawal',
  deposit_hold: 'Deposit held',
  deposit_release: 'Deposit returned',
  late_fee: 'Late fee',
};

export function Wallet() {
  const { member, refresh: refreshSession } = useSession();
  const [view, setView] = useState<WalletView | null>(null);
  const [amount, setAmount] = useState('100');
  const [payoutAddress, setPayoutAddress] = useState(member?.payoutAddress ?? '');
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setView(await api.wallet());
    } catch (err) {
      setError(err);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function run(action: () => Promise<unknown>, done: string) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await action();
      await Promise.all([load(), refreshSession()]);
      setNotice(done);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  if (!view) return error ? <ErrorNote error={error} /> : <Spinner />;

  return (
    <section className="narrow">
      <h1>Wallet</h1>
      <div className="balances">
        <div className="card stat">
          <span className="stat-label">Available</span>
          <span className="stat-value">{usdc(view.balances.available)}</span>
          <span className="muted small">Ready for deposits and withdrawals.</span>
        </div>
        <div className="card stat">
          <span className="stat-label">Held in escrow</span>
          <span className="stat-value">{usdc(view.balances.escrow)}</span>
          <span className="muted small">Deposits on tools you have asked for or have out.</span>
        </div>
      </div>

      <ErrorNote error={error} />
      {notice && <p className="notice">{notice}</p>}

      {view.provider === 'mock' && (
        <div className="card">
          <h3>Add test USDC</h3>
          <p className="muted small">
            This deployment runs the mock payment provider: top-ups are credited instantly and no real USDC
            moves. Swap in a chain-backed provider before real money is involved.
          </p>
          <div className="row row-end">
            <Field label="Amount (USDC)">
              <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </Field>
            <button
              className="primary"
              disabled={busy}
              onClick={() => void run(() => api.topUp(amount), `Credited ${amount} USDC.`)}
            >
              Top up
            </button>
          </div>
        </div>
      )}

      <div className="card">
        <h3>Withdraw</h3>
        <Field label="Payout address" hint="An EVM address that can receive USDC.">
          <input value={payoutAddress} onChange={(e) => setPayoutAddress(e.target.value)} placeholder="0x…" />
        </Field>
        <div className="row row-end">
          <button
            disabled={busy}
            onClick={() => void run(() => api.updateProfile({ payoutAddress }), 'Payout address saved.')}
          >
            Save address
          </button>
          <button
            disabled={busy}
            onClick={() => void run(() => api.withdraw(amount), `Sent ${amount} USDC to your payout address.`)}
          >
            Withdraw {amount} USDC
          </button>
        </div>
      </div>

      <h2>Activity</h2>
      {view.entries.length === 0 ? (
        <p className="muted">Nothing yet.</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>When</th>
              <th>What</th>
              <th>Account</th>
              <th className="right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {view.entries.map((entry) => (
              <tr key={entry.id}>
                <td>{dateTime(entry.createdAt)}</td>
                <td>{KIND_LABELS[entry.kind] ?? entry.kind}</td>
                <td>{entry.account}</td>
                <td className={entry.amount.micros < 0 ? 'right negative' : 'right positive'}>
                  {entry.amount.micros > 0 ? '+' : ''}
                  {usdc(entry.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
