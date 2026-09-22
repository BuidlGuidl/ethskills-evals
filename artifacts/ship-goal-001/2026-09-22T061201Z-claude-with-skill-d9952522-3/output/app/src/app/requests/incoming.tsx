"use client";

import {useRouter} from "next/navigation";
import {useState} from "react";
import {useAccount, useSignTypedData} from "wagmi";
import {hashTypedData} from "viem";

import {MemberLink, RecordBadge, Usdc} from "@/components/ui.tsx";
import {TERMS_TYPES, eip712Domain, serialiseTerms, type Terms} from "@/core/eip712.ts";
import {DAY_SECONDS} from "@/core/loan.ts";
import type {RankedRequest} from "@/server/requests.ts";
import type {TrackRecord} from "@/core/reputation.ts";

type Row = Omit<RankedRequest, "borrowerRecord"> & {
  borrowerRecord: TrackRecord;
  deposit: bigint | string;
  dailyLateFee: bigint | string;
  maxDays: number;
};

/** How long a borrower has to collect the tool before the approval goes stale. */
const OFFER_WINDOW_SECONDS = 3 * 24 * 60 * 60;

/**
 * The owner's approval queue.
 *
 * Approving is a signature, not a transaction: the owner signs EIP-712 loan terms, and the
 * borrower carries that signature to the contract along with their deposit. That is what keeps
 * lending free for the owner — they never pay gas to lend a tool, only (optionally) to confirm it
 * came back.
 */
export function IncomingQueue({requests}: {requests: Row[]}) {
  return (
    <ul className="space-y-3">
      {requests.map((request) => (
        <RequestCard key={request.id} request={request} />
      ))}
    </ul>
  );
}

function RequestCard({request}: {request: Row}) {
  const router = useRouter();
  const {address, chainId} = useAccount();
  const {signTypedDataAsync} = useSignTypedData();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deposit = BigInt(request.deposit);
  const dailyLateFee = BigInt(request.dailyLateFee);

  async function approve() {
    setError(null);
    setBusy(true);
    try {
      const escrow = process.env.NEXT_PUBLIC_ESCROW_ADDRESS as `0x${string}`;
      const configuredChain = Number(process.env.NEXT_PUBLIC_CHAIN_ID);
      if (chainId !== configuredChain) {
        throw new Error(`Switch your wallet to chain ${configuredChain} first.`);
      }

      const now = BigInt(Math.floor(Date.now() / 1000));
      const terms: Terms = {
        owner: address as `0x${string}`,
        borrower: request.borrowerAddress as `0x${string}`,
        listingId: request.listingId as `0x${string}`,
        deposit,
        dailyLateFee,
        // The clock starts now, not at collection: if the borrower dawdles for two days before
        // picking the tool up, that comes out of their own borrowing window, not the owner's.
        dueAt: now + BigInt(request.days) * DAY_SECONDS,
        offerExpiry: now + BigInt(OFFER_WINDOW_SECONDS),
        salt: BigInt(`0x${crypto.randomUUID().replace(/-/g, "")}`),
      };

      const domain = eip712Domain(configuredChain, escrow);
      const signature = await signTypedDataAsync({
        domain,
        types: TERMS_TYPES,
        primaryType: "Terms",
        message: terms,
      });

      // The contract uses the EIP-712 digest as the loan id, so we can compute it here and hand
      // the indexer something to match the eventual LoanOpened event against.
      const loanId = hashTypedData({
        domain,
        types: TERMS_TYPES,
        primaryType: "Terms",
        message: terms,
      });

      const response = await fetch(`/api/requests/${request.id}/approve`, {
        method: "POST",
        headers: {"content-type": "application/json"},
        body: JSON.stringify({terms: serialiseTerms(terms), signature, loanId}),
      });
      if (!response.ok) {
        const {error: reason} = (await response.json()) as {error: string};
        throw new Error(reason);
      }
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not approve.");
    } finally {
      setBusy(false);
    }
  }

  async function decline() {
    setBusy(true);
    await fetch(`/api/requests/${request.id}/decline`, {method: "POST"});
    setBusy(false);
    router.refresh();
  }

  const expired =
    request.status === "approved" && request.offerExpiry !== null
      ? request.offerExpiry * 1000 < Date.now()
      : false;

  return (
    <li className="card space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium">
            <MemberLink address={request.borrowerAddress} name={request.borrowerName} /> wants{" "}
            {request.listingTitle} for {request.days} days
          </p>
          <div className="mt-2">
            <RecordBadge record={request.borrowerRecord} role="borrower" />
          </div>
        </div>
        <p className="text-sm text-stone-600">
          <Usdc amount={deposit} /> deposit · <Usdc amount={dailyLateFee} />/day late
        </p>
      </div>

      {request.message ? (
        <p className="rounded-md bg-stone-50 p-3 text-sm text-stone-700">{request.message}</p>
      ) : null}

      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      {request.status === "approved" ? (
        <p className="text-sm text-stone-600">
          {expired
            ? "Approved, but the offer window has passed. Decline it and let them ask again."
            : "Approved — waiting for them to collect the tool and pay the deposit."}
        </p>
      ) : (
        <div className="flex gap-2">
          <button className="btn-primary" disabled={busy} onClick={() => void approve()}>
            {busy ? "Signing…" : "Approve"}
          </button>
          <button className="btn-secondary" disabled={busy} onClick={() => void decline()}>
            Decline
          </button>
        </div>
      )}
    </li>
  );
}
