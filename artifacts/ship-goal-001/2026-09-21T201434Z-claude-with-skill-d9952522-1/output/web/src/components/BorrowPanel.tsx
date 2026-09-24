"use client";

import { useState } from "react";
import { useAccount, usePublicClient, useSignMessage, useWriteContract } from "wagmi";
import { decodeEventLog, maxUint256, type Address } from "viem";
import { erc20Abi, toolshedAbi } from "@/core/abi";
import { formatUsdc, toolshedAddress, usdcAddress } from "@/core/chain";
import { signedPost } from "@/core/signedFetch";

/**
 * The borrow flow, which is two transactions:
 *
 *   1. approve USDC to the escrow (skipped when the allowance already covers it)
 *   2. request(), which pulls the deposit into escrow and notifies the owner
 *
 * The owner then approves onchain and hands the tool over in person.
 */
export function BorrowPanel({
  listingId,
  listingRef,
  ownerAddress,
  deposit,
  dailyLateFee,
  maxDays,
  disabled,
  disabledReason,
}: {
  listingId: string;
  listingRef: `0x${string}`;
  ownerAddress: string;
  deposit: string;
  dailyLateFee: string;
  maxDays: number;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const { signMessageAsync } = useSignMessage();

  const [days, setDays] = useState(Math.min(3, maxDays));
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isOwnTool = address?.toLowerCase() === ownerAddress.toLowerCase();

  async function borrow() {
    if (!address || !publicClient) return;
    setBusy(true);
    setError(null);

    try {
      const amount = BigInt(deposit);

      const allowance = await publicClient.readContract({
        address: usdcAddress,
        abi: erc20Abi,
        functionName: "allowance",
        args: [address, toolshedAddress],
      });

      if (allowance < amount) {
        setStatus("Approving USDC…");
        const approveHash = await writeContractAsync({
          address: usdcAddress,
          abi: erc20Abi,
          functionName: "approve",
          args: [toolshedAddress, maxUint256],
        });
        await publicClient.waitForTransactionReceipt({ hash: approveHash });
      }

      setStatus("Placing your deposit…");
      const hash = await writeContractAsync({
        address: toolshedAddress,
        abi: toolshedAbi,
        functionName: "request",
        args: [ownerAddress as Address, listingRef, amount, BigInt(dailyLateFee), days],
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      // Pull the loan id out of the receipt so we can link it to this listing.
      let loanId: number | null = null;
      for (const log of receipt.logs) {
        if (log.address.toLowerCase() !== toolshedAddress.toLowerCase()) continue;
        try {
          const decoded = decodeEventLog({ abi: toolshedAbi, data: log.data, topics: log.topics });
          if (decoded.eventName === "LoanRequested") {
            loanId = Number((decoded.args as { loanId: bigint }).loanId);
            break;
          }
        } catch {
          // Not an event we recognise; keep looking.
        }
      }

      if (loanId !== null) {
        // Best-effort: the indexer recovers this mapping from the listingRef
        // hash anyway, so a failure here must not look like a failed borrow.
        await signedPost("/api/loans", "link-loan", address, signMessageAsync, { loanId, listingId }).catch(
          () => undefined,
        );
      }

      setStatus(`Requested. ${ownerAddress.slice(0, 6)}… has 3 days to hand the tool over or your deposit unlocks.`);
    } catch (err) {
      setError(err instanceof Error ? err.message.split("\n")[0] : "Something went wrong");
      setStatus(null);
    } finally {
      setBusy(false);
    }
  }

  if (!isConnected) return <p className="hint">Sign in to borrow this.</p>;
  if (isOwnTool) return <p className="hint">This is your own listing.</p>;
  if (disabled) return <p className="hint">{disabledReason ?? "Not available right now."}</p>;

  return (
    <div>
      <div className="field">
        <label htmlFor="days">Borrow for</label>
        <select id="days" value={days} onChange={(e) => setDays(Number(e.target.value))}>
          {Array.from({ length: maxDays }, (_, i) => i + 1).map((d) => (
            <option key={d} value={d}>
              {d} {d === 1 ? "day" : "days"}
            </option>
          ))}
        </select>
        <p className="hint">
          Bring it back within {days} {days === 1 ? "day" : "days"} and you get all ${formatUsdc(deposit)} back.
          After that it&rsquo;s ${formatUsdc(dailyLateFee)} per day to the owner, out of your deposit, up to the
          full ${formatUsdc(deposit)}.
        </p>
      </div>

      <button onClick={borrow} disabled={busy}>
        {busy ? "Working…" : `Put down $${formatUsdc(deposit)} and ask`}
      </button>

      {status && <p className="hint">{status}</p>}
      {error && <p className="error">{error}</p>}
    </div>
  );
}
