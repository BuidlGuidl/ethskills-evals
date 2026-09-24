"use client";

import Link from "next/link";
import { useAccount } from "wagmi";
import { LoanRow } from "@/components/LoanRow";
import { TrackRecordBadge } from "@/components/TrackRecordBadge";
import { ConfigWarning } from "@/components/ConfigWarning";
import { ConnectPrompt } from "@/components/ConnectPrompt";
import { useMembership, useMyLoans } from "@/hooks/useToolshed";
import { LoanStatus, OPEN_LOAN_STATUSES } from "@/lib/contracts";
import { formatUsdc } from "@/lib/format";

export default function BorrowPage() {
  const { isConnected } = useAccount();
  const { record } = useMembership();
  const { items, isLoading } = useMyLoans();

  if (!isConnected) {
    return <ConnectPrompt>Connect your wallet to see the tools you have out and your track record.</ConnectPrompt>;
  }

  const openStatuses = [LoanStatus.Requested, ...OPEN_LOAN_STATUSES];
  const current = items.filter((i) => openStatuses.includes(i.loan.status as LoanStatus));
  const past = items.filter((i) => !openStatuses.includes(i.loan.status as LoanStatus));
  const escrowed = current.reduce((sum, i) => sum + i.loan.deposit, 0n);

  return (
    <div className="flex flex-col gap-6">
      <ConfigWarning />

      <header>
        <h1 className="text-2xl font-semibold tracking-tight">My loans</h1>
        <div className="mt-1">
          <TrackRecordBadge record={record} />
        </div>
        {escrowed > 0n && (
          <p className="mt-2 text-sm text-shed-600">
            {formatUsdc(escrowed)} of your USDC is in escrow across {current.length} open{" "}
            {current.length === 1 ? "loan" : "loans"}.
          </p>
        )}
      </header>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Open</h2>
        {isLoading && <p className="text-sm text-shed-600">Loading…</p>}
        {!isLoading && current.length === 0 && (
          <p className="card p-4 text-sm text-shed-600">
            Nothing borrowed right now.{" "}
            <Link className="underline" href="/">
              Browse the shed
            </Link>
            .
          </p>
        )}
        <ul className="flex flex-col gap-3">
          {current.map((item) => (
            <LoanRow key={item.id.toString()} item={item} role="borrower" />
          ))}
        </ul>
      </section>

      {past.length > 0 && (
        <section>
          <h2 className="mb-2 text-lg font-semibold">History</h2>
          <ul className="flex flex-col gap-3">
            {past.map((item) => (
              <LoanRow key={item.id.toString()} item={item} role="borrower" />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
