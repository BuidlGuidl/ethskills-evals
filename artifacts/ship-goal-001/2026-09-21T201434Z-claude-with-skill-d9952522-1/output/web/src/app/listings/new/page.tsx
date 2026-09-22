"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAccount, useSignMessage } from "wagmi";
import { signedPost, signedUpload } from "@/core/signedFetch";

export default function NewListingPage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();

  const [form, setForm] = useState({
    title: "",
    description: "",
    conditionNote: "",
    deposit: "40.00",
    dailyLateFee: "2.00",
    maxDays: 7,
  });
  const [photo, setPhoto] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!address) return;

    setBusy(true);
    setError(null);
    try {
      // Two signatures: one for the photo upload, one for the listing itself.
      const photoUrl = photo ? await signedUpload(photo, address, signMessageAsync) : null;

      const { listing } = await signedPost<{ listing: { id: string } }>(
        "/api/listings",
        "create-listing",
        address,
        signMessageAsync,
        { ...form, photoUrl },
      );

      router.push(`/listings/${listing.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the listing");
    } finally {
      setBusy(false);
    }
  }

  if (!isConnected) {
    return (
      <>
        <h1>Lend a tool</h1>
        <p className="sub">Sign in to list something from your shed.</p>
      </>
    );
  }

  return (
    <>
      <h1>Lend a tool</h1>
      <p className="sub">
        Listing something is free. You only ever receive money if a neighbor brings it back late.
      </p>

      <form className="panel" onSubmit={submit} style={{ maxWidth: 620 }}>
        <div className="field">
          <label htmlFor="title">What is it?</label>
          <input
            id="title"
            required
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="Cordless drill, 18V"
          />
        </div>

        <div className="field">
          <label htmlFor="photo">Photo</label>
          <input id="photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
          <p className="hint">A real photo of the actual tool helps more than anything else in this form.</p>
        </div>

        <div className="field">
          <label htmlFor="description">Description</label>
          <textarea
            id="description"
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="Comes with two batteries and a charger, in a hard case."
          />
        </div>

        <div className="field">
          <label htmlFor="condition">Condition notes</label>
          <textarea
            id="condition"
            value={form.conditionNote}
            onChange={(e) => set("conditionNote", e.target.value)}
            placeholder="Chuck sticks a little. Battery B holds about half a charge."
          />
          <p className="hint">Be honest here — it is what you will point at if something comes back worse.</p>
        </div>

        <div className="row">
          <div className="field">
            <label htmlFor="deposit">Deposit (USDC)</label>
            <input
              id="deposit"
              required
              inputMode="decimal"
              value={form.deposit}
              onChange={(e) => set("deposit", e.target.value)}
            />
            <p className="hint">Roughly what it would cost you to replace it.</p>
          </div>

          <div className="field">
            <label htmlFor="fee">Late fee per day (USDC)</label>
            <input
              id="fee"
              required
              inputMode="decimal"
              value={form.dailyLateFee}
              onChange={(e) => set("dailyLateFee", e.target.value)}
            />
            <p className="hint">Taken from the deposit, capped at the deposit.</p>
          </div>
        </div>

        <div className="field">
          <label htmlFor="maxDays">Longest loan (days)</label>
          <input
            id="maxDays"
            type="number"
            min={1}
            max={90}
            value={form.maxDays}
            onChange={(e) => set("maxDays", Number(e.target.value))}
          />
        </div>

        <button type="submit" disabled={busy}>
          {busy ? "Saving…" : "List it"}
        </button>
        {error && <p className="error">{error}</p>}
      </form>
    </>
  );
}
