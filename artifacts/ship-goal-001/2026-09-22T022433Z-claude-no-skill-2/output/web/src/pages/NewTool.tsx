import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { categoryLabel } from '../lib/format.js';
import { ErrorNote, Field } from '../components/Bits.js';

/**
 * Listing form. The defaults are deliberately conservative: a deposit that
 * covers replacing the tool, and a late fee that makes a slow return annoying
 * rather than ruinous.
 */
export function NewTool() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<string[]>([]);
  const [form, setForm] = useState({
    name: '',
    category: 'power-tools',
    description: '',
    conditionNotes: '',
    deposit: '75',
    lateFeePerDay: '3',
    maxLoanDays: '4',
  });
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    api.categories().then(setCategories).catch(setError);
  }, []);

  useEffect(() => {
    if (!photo) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(photo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  const set = (key: keyof typeof form) => (event: { target: { value: string } }) =>
    setForm((prev) => ({ ...prev, [key]: event.target.value }));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const data = new FormData();
      for (const [key, value] of Object.entries(form)) data.set(key, value);
      if (photo) data.set('photo', photo);
      const tool = await api.createTool(data);
      navigate(`/tools/${tool.id}`);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="narrow">
      <h1>List a tool</h1>
      <p className="muted">
        A photo and honest condition notes save a lot of messages. Deposits and late fees are in USDC.
      </p>

      <form className="card form" onSubmit={submit}>
        <Field label="What is it?" hint="Make and model help.">
          <input required minLength={2} value={form.name} onChange={set('name')} />
        </Field>

        <Field label="Category">
          <select value={form.category} onChange={set('category')}>
            {(categories.length ? categories : [form.category]).map((key) => (
              <option key={key} value={key}>
                {categoryLabel(key)}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Photo" hint="JPEG, PNG or WebP, up to 8 MB.">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
          />
        </Field>
        {preview && <img className="preview" src={preview} alt="Selected photo preview" />}

        <Field label="Description" hint="What it is good for, what to bring.">
          <textarea rows={3} value={form.description} onChange={set('description')} />
        </Field>

        <Field label="Condition notes" hint="Quirks, damage, missing pieces — be honest here.">
          <textarea rows={3} value={form.conditionNotes} onChange={set('conditionNotes')} />
        </Field>

        <div className="row">
          <Field label="Deposit (USDC)" hint="Roughly what it would cost to replace.">
            <input required inputMode="decimal" value={form.deposit} onChange={set('deposit')} />
          </Field>
          <Field label="Late fee per day (USDC)" hint="Taken from the deposit, paid to you.">
            <input required inputMode="decimal" value={form.lateFeePerDay} onChange={set('lateFeePerDay')} />
          </Field>
          <Field label="Max loan (days)">
            <input required type="number" min={1} max={90} value={form.maxLoanDays} onChange={set('maxLoanDays')} />
          </Field>
        </div>

        <ErrorNote error={error} />
        <button className="primary" type="submit" disabled={busy}>
          {busy ? 'Listing…' : 'Add to the shed'}
        </button>
      </form>
    </section>
  );
}
