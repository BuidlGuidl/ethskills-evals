"use client";

import {useRouter} from "next/navigation";
import {useState} from "react";

import {Field} from "@/components/ui.tsx";
import {useSession} from "@/components/session.tsx";

/**
 * Listing a tool.
 *
 * All offchain: a photo, a description, condition notes, and the two numbers that will later go
 * into the signed loan terms. Nothing is written to the chain until someone actually borrows it —
 * listing a tool should cost nothing and take a minute.
 */
export default function NewToolPage() {
  const router = useRouter();
  const {member, loading} = useSession();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [conditionNotes, setConditionNotes] = useState("");
  const [deposit, setDeposit] = useState("40");
  const [dailyLateFee, setDailyLateFee] = useState("2");
  const [maxDays, setMaxDays] = useState(7);
  const [photo, setPhoto] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (loading) return <p className="text-stone-500">Loading…</p>;
  if (!member) {
    return (
      <p className="rounded-lg border border-dashed border-stone-300 bg-white p-8 text-center text-stone-500">
        Sign in with your wallet to list a tool.
      </p>
    );
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      let photoPath: string | null = null;
      if (photo) {
        const form = new FormData();
        form.append("photo", photo);
        const upload = await fetch("/api/uploads", {method: "POST", body: form});
        if (!upload.ok) {
          const {error: reason} = (await upload.json()) as {error: string};
          throw new Error(reason);
        }
        ({photoPath} = (await upload.json()) as {photoPath: string});
      }

      const response = await fetch("/api/listings", {
        method: "POST",
        headers: {"content-type": "application/json"},
        body: JSON.stringify({
          title,
          description,
          conditionNotes,
          deposit,
          dailyLateFee,
          maxDays,
          photoPath,
        }),
      });
      if (!response.ok) {
        const {error: reason} = (await response.json()) as {error: string};
        throw new Error(reason);
      }
      const {listing} = (await response.json()) as {listing: {id: string}};
      router.push(`/tools/${listing.id}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not list that.");
      setBusy(false);
    }
  }

  return (
    <form className="mx-auto max-w-xl space-y-5" onSubmit={submit}>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">List a tool</h1>
        <p className="mt-1 text-sm text-stone-600">
          Be honest about the condition — it is the thing that stops arguments later.
        </p>
      </div>

      <Field label="What is it?">
        <input
          className="input"
          value={title}
          maxLength={120}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Bosch 18V cordless drill"
          required
        />
      </Field>

      <Field label="Photo" hint="JPEG, PNG or WebP, up to 6 MB.">
        <input
          className="input"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(event) => setPhoto(event.target.files?.[0] ?? null)}
        />
      </Field>

      <Field label="Description">
        <textarea
          className="input"
          rows={3}
          value={description}
          maxLength={2000}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Comes with two batteries, charger and a bit set."
        />
      </Field>

      <Field
        label="Condition notes"
        hint="Scratches, quirks, the bit that sticks. Say it now, not after it comes back."
      >
        <textarea
          className="input"
          rows={3}
          value={conditionNotes}
          maxLength={2000}
          onChange={(event) => setConditionNotes(event.target.value)}
          placeholder="Chuck is a bit worn. Second battery holds about half a charge."
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Deposit (USDC)" hint="Roughly what it would cost you to replace it.">
          <input
            className="input"
            value={deposit}
            onChange={(event) => setDeposit(event.target.value)}
            inputMode="decimal"
            required
          />
        </Field>

        <Field
          label="Late fee (USDC per day)"
          hint="Charged for every started day past the due date, out of the deposit."
        >
          <input
            className="input"
            value={dailyLateFee}
            onChange={(event) => setDailyLateFee(event.target.value)}
            inputMode="decimal"
            required
          />
        </Field>
      </div>

      <Field label="Longest loan (days)">
        <input
          className="input"
          type="number"
          min={1}
          max={180}
          value={maxDays}
          onChange={(event) => setMaxDays(Number(event.target.value))}
          required
        />
      </Field>

      <p className="rounded-md bg-stone-100 p-3 text-xs text-stone-600">
        The late fee has to be more than zero and no larger than the deposit. That is what
        guarantees a deposit can never sit in escrow forever: if a tool is never returned, the fee
        eventually covers the whole deposit and you can claim it.
      </p>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      <button className="btn-primary" disabled={busy}>
        {busy ? "Listing…" : "List it"}
      </button>
    </form>
  );
}
