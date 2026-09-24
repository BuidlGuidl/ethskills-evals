"use client";

import {useRouter} from "next/navigation";
import {useState} from "react";

import {Field} from "@/components/ui.tsx";
import {useSession} from "@/components/session.tsx";

/**
 * Asking to borrow.
 *
 * Nothing onchain happens here, and no money moves. This is a message to the owner; the loan only
 * exists once the owner signs terms and the borrower takes them to the contract.
 */
export function RequestForm({
  listingId,
  maxDays,
  signedIn,
}: {
  listingId: string;
  maxDays: number;
  signedIn: boolean;
}) {
  const router = useRouter();
  const {member} = useSession();
  const [days, setDays] = useState(Math.min(3, maxDays));
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  if (!signedIn && !member) {
    return (
      <p className="card text-sm text-stone-600">
        Sign in with your wallet to ask to borrow this.
      </p>
    );
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setStatus("sending");
    setError(null);

    const response = await fetch("/api/requests", {
      method: "POST",
      headers: {"content-type": "application/json"},
      body: JSON.stringify({listingId, days, message}),
    });

    if (!response.ok) {
      const {error: reason} = (await response.json()) as {error: string};
      setError(reason);
      setStatus("idle");
      return;
    }

    setStatus("sent");
    router.refresh();
  }

  if (status === "sent") {
    return (
      <p className="card text-sm text-stone-700">
        Asked. The owner will see your request — and your track record — in their queue. You will
        be able to collect the tool once they approve.
      </p>
    );
  }

  return (
    <form className="card space-y-4" onSubmit={submit}>
      <h2 className="font-semibold">Ask to borrow</h2>

      <Field label="For how many days?" hint={`This owner lends for up to ${maxDays} days.`}>
        <input
          className="input"
          type="number"
          min={1}
          max={maxDays}
          value={days}
          onChange={(event) => setDays(Number(event.target.value))}
          required
        />
      </Field>

      <Field label="Anything to tell them?" hint="What for, and when you would pick it up.">
        <textarea
          className="input"
          rows={3}
          value={message}
          maxLength={1000}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Putting up shelves on Saturday — could grab it Friday evening."
        />
      </Field>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      <button className="btn-primary w-full" disabled={status === "sending"}>
        {status === "sending" ? "Asking…" : "Ask to borrow"}
      </button>
    </form>
  );
}
