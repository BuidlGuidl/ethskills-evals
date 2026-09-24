"use client";

import { useState } from "react";
import { createWalletClient, custom, type EIP1193Provider } from "viem";
import { base } from "viem/chains";
import { STREAK_ADDRESS, streakAbi } from "../lib/contract";

/** The app's only write: one check-in per UTC day, with an optional note. */
export function CheckInButton() {
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const provider = (globalThis as { ethereum?: EIP1193Provider }).ethereum;
    if (!provider) return setStatus("No wallet found");

    try {
      setStatus("Confirm in your wallet…");
      const wallet = createWalletClient({ chain: base, transport: custom(provider) });
      const [account] = await wallet.requestAddresses();
      const hash = await wallet.writeContract({
        account,
        address: STREAK_ADDRESS,
        abi: streakAbi,
        functionName: "checkIn",
        args: [note],
      });
      setStatus(`Checked in — ${hash.slice(0, 10)}…`);
      setNote("");
    } catch (err) {
      // The contract reverts with AlreadyCheckedInToday for a second check-in.
      setStatus(err instanceof Error ? err.message.split("\n")[0] : "Failed");
    }
  }

  return (
    <form className="checkin" onSubmit={submit}>
      <input
        className="grow"
        value={note}
        maxLength={140}
        placeholder="gm (optional note)"
        onChange={(e) => setNote(e.target.value)}
      />
      <button type="submit">Check in</button>
      {status && <span className="muted">{status}</span>}
    </form>
  );
}
