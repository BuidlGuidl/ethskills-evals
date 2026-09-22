"use client";

import { useState } from "react";
import { TxButton } from "./TxButton";
import { formatUsdc, parseUsdc } from "@/lib/format";

/**
 * Listing happens in two visible steps, because they are two different kinds of operation:
 * the photo and notes go to IPFS over HTTP, then the terms go onchain in a transaction.
 */
export function ListToolForm({ onListed }: { onListed?: () => void }) {
  const [name, setName] = useState("");
  const [condition, setCondition] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [deposit, setDeposit] = useState("40");
  const [lateFee, setLateFee] = useState("3");
  const [maxDays, setMaxDays] = useState("7");

  const [metadataURI, setMetadataURI] = useState<string | null>(null);
  const [pinned, setPinned] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const depositUnits = safeParse(deposit);
  const lateFeeUnits = safeParse(lateFee);
  const days = Number(maxDays);

  const termsValid =
    depositUnits !== null &&
    depositUnits > 0n &&
    lateFeeUnits !== null &&
    lateFeeUnits > 0n &&
    lateFeeUnits <= depositUnits &&
    Number.isInteger(days) &&
    days > 0 &&
    days <= 365;

  async function upload() {
    setUploading(true);
    setError(null);
    try {
      const body = new FormData();
      body.set("name", name);
      body.set("condition", condition);
      body.set("imageUrl", imageUrl);
      if (photo) body.set("photo", photo);
      const res = await fetch("/api/upload", { method: "POST", body });
      const data = (await res.json()) as { metadataURI?: string; pinned?: boolean; error?: string };
      if (!res.ok || !data.metadataURI) throw new Error(data.error ?? "Upload failed");
      setMetadataURI(data.metadataURI);
      setPinned(!!data.pinned);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function resetForm() {
    setName("");
    setCondition("");
    setImageUrl("");
    setPhoto(null);
    setMetadataURI(null);
    onListed?.();
  }

  return (
    <section className="card p-4">
      <h2 className="mb-3 text-lg font-semibold">List a tool</h2>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="sm:col-span-2">
          <span className="label">What is it?</span>
          <input
            className="input"
            value={name}
            placeholder="Cordless drill"
            onChange={(e) => {
              setName(e.target.value);
              setMetadataURI(null);
            }}
          />
        </label>

        <label className="sm:col-span-2">
          <span className="label">Condition notes</span>
          <textarea
            className="input"
            rows={2}
            value={condition}
            placeholder="18V, two batteries. Chuck is a bit worn but holds fine."
            onChange={(e) => {
              setCondition(e.target.value);
              setMetadataURI(null);
            }}
          />
        </label>

        <label>
          <span className="label">Photo</span>
          <input
            className="input"
            type="file"
            accept="image/*"
            onChange={(e) => {
              setPhoto(e.target.files?.[0] ?? null);
              setMetadataURI(null);
            }}
          />
          <span className="hint">Pinned to IPFS. Needs PINATA_JWT on the server.</span>
        </label>

        <label>
          <span className="label">…or a photo URL</span>
          <input
            className="input"
            value={imageUrl}
            placeholder="https://… or ipfs://…"
            onChange={(e) => {
              setImageUrl(e.target.value);
              setMetadataURI(null);
            }}
          />
        </label>

        <label>
          <span className="label">Deposit (USDC)</span>
          <input className="input" value={deposit} inputMode="decimal" onChange={(e) => setDeposit(e.target.value)} />
          <span className="hint">Roughly what it would cost you to replace it.</span>
        </label>

        <label>
          <span className="label">Late fee per day (USDC)</span>
          <input className="input" value={lateFee} inputMode="decimal" onChange={(e) => setLateFee(e.target.value)} />
          <span className="hint">Comes out of the deposit and goes to you. Capped at the deposit.</span>
        </label>

        <label>
          <span className="label">Longest loan (days)</span>
          <input className="input" value={maxDays} inputMode="numeric" onChange={(e) => setMaxDays(e.target.value)} />
        </label>
      </div>

      {!termsValid && (
        <p className="mt-3 text-xs text-amber-800">
          The deposit and the daily late fee both have to be above zero (a zero late fee is what makes a tool that
          never comes back cost the borrower nothing), the fee cannot exceed the deposit, and the longest loan has to
          be between 1 and 365 days.
        </p>
      )}
      {error && <p className="mt-3 text-xs text-red-700">{error}</p>}

      <div className="mt-4 flex flex-wrap items-start gap-3">
        <button className="btn-secondary" disabled={!name || uploading} onClick={upload}>
          {uploading ? "Uploading…" : metadataURI ? "Re-upload details" : "1 · Upload photo and notes"}
        </button>

        {metadataURI && depositUnits !== null && lateFeeUnits !== null && (
          <TxButton
            functionName="listTool"
            args={[metadataURI, depositUnits, lateFeeUnits, days]}
            disabled={!termsValid}
            pendingLabel="Listing…"
            onDone={resetForm}
          >
            2 · List it for {formatUsdc(depositUnits)}
          </TxButton>
        )}
      </div>

      {metadataURI && (
        <p className="hint break-all">
          {pinned ? "Pinned: " : "Stored inline (no IPFS configured): "}
          {metadataURI.slice(0, 80)}
          {metadataURI.length > 80 ? "…" : ""}
        </p>
      )}
    </section>
  );
}

function safeParse(value: string): bigint | null {
  try {
    return parseUsdc(value);
  } catch {
    return null;
  }
}
