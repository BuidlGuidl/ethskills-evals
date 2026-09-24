"use client";

import { useState } from "react";
import {
  createWalletClient,
  createPublicClient,
  custom,
  http,
  type Address,
} from "viem";
import { base, baseSepolia } from "viem/chains";
import { chainId, streakAddress } from "@/config";
import abi from "@/abi/Streak.json";

const chain = chainId === baseSepolia.id ? baseSepolia : base;

/**
 * The app's only write. Deliberately thin — no wallet-connector dependency,
 * just EIP-1193. Everything interesting happens on the read side; this just
 * puts an event on chain for the indexer to pick up.
 */
export function CheckInButton() {
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function checkIn() {
    const ethereum = (globalThis as { ethereum?: unknown }).ethereum;
    if (!ethereum) {
      setStatus("No wallet found in this browser.");
      return;
    }

    setBusy(true);
    setStatus(null);
    try {
      const transport = custom(ethereum as Parameters<typeof custom>[0]);
      const wallet = createWalletClient({ chain, transport });
      const [account] = await wallet.requestAddresses();
      await wallet.switchChain({ id: chain.id }).catch(() => {
        // Wallet may not know the chain yet; the send below will surface it.
      });

      const hash = await wallet.writeContract({
        account: account as Address,
        address: streakAddress,
        abi,
        functionName: "checkIn",
        args: [note],
        chain,
      });

      setStatus("Submitted — waiting for confirmation…");
      const publicClient = createPublicClient({ chain, transport: http() });
      await publicClient.waitForTransactionReceipt({ hash });
      // The subgraph needs a moment to index the new log; the feed polls, so
      // it will appear on its own within a few seconds.
      setStatus("Checked in. It'll show up in the feed shortly.");
      setNote("");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatus(
        /AlreadyCheckedInToday/.test(message)
          ? "You've already checked in today. Come back after midnight UTC."
          : message.split("\n")[0]
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="checkin-box">
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="gm — say something (optional)"
          maxLength={140}
        />
        <button className="primary" onClick={checkIn} disabled={busy}>
          {busy ? "…" : "Check in"}
        </button>
      </div>
      {status && (
        <p className="muted" style={{ fontSize: 13, marginTop: -8 }}>
          {status}
        </p>
      )}
    </div>
  );
}
