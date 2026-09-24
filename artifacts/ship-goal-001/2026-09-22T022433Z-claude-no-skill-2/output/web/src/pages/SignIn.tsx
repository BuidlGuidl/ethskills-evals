import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useSession } from '../lib/session.js';
import { ErrorNote, Field } from '../components/Bits.js';

/** Sign in and join, on one screen. Joining needs the association's invite code. */
export function SignIn() {
  const { setMember } = useSession();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [form, setForm] = useState({
    email: '',
    password: '',
    displayName: '',
    unit: '',
    inviteCode: '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const set = (key: keyof typeof form) => (event: { target: { value: string } }) =>
    setForm((prev) => ({ ...prev, [key]: event.target.value }));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const member =
        mode === 'login'
          ? await api.login({ email: form.email, password: form.password })
          : await api.signup({
              email: form.email,
              password: form.password,
              displayName: form.displayName,
              unit: form.unit || undefined,
              inviteCode: form.inviteCode,
            });
      setMember(member);
      navigate('/');
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <div className="auth-pitch">
        <h1>Toolshed</h1>
        <p>
          The neighbourhood association's lending library. List the tools you own, borrow what you need, and
          put down a USDC deposit that comes straight back when the tool does.
        </p>
        <ul className="auth-points">
          <li>Deposits are held in escrow for the length of the loan.</li>
          <li>Tools back late cost a fixed fee per day, paid to the owner from the deposit.</li>
          <li>Every loan builds your track record — reliable borrowers get first pick.</li>
        </ul>
      </div>

      <form className="card auth-form" onSubmit={submit}>
        <div className="tabs">
          <button
            type="button"
            className={mode === 'login' ? 'tab active' : 'tab'}
            onClick={() => setMode('login')}
          >
            Sign in
          </button>
          <button
            type="button"
            className={mode === 'signup' ? 'tab active' : 'tab'}
            onClick={() => setMode('signup')}
          >
            Join
          </button>
        </div>

        <Field label="Email">
          <input type="email" required value={form.email} onChange={set('email')} autoComplete="email" />
        </Field>
        <Field label="Password" hint={mode === 'signup' ? 'At least 10 characters.' : undefined}>
          <input
            type="password"
            required
            value={form.password}
            onChange={set('password')}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          />
        </Field>

        {mode === 'signup' && (
          <>
            <Field label="Name neighbours will see">
              <input required value={form.displayName} onChange={set('displayName')} />
            </Field>
            <Field label="Unit or house number" hint="Optional, helps with pickups.">
              <input value={form.unit} onChange={set('unit')} />
            </Field>
            <Field label="Association invite code">
              <input required value={form.inviteCode} onChange={set('inviteCode')} />
            </Field>
          </>
        )}

        <ErrorNote error={error} />
        <button className="primary" type="submit" disabled={busy}>
          {busy ? 'Working…' : mode === 'login' ? 'Sign in' : 'Join the library'}
        </button>
      </form>
    </div>
  );
}
