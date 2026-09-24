"use client";

import { useAccount } from "wagmi";
import { ListToolForm } from "@/components/ListToolForm";
import { LoanRow } from "@/components/LoanRow";
import { TxButton } from "@/components/TxButton";
import { TrackRecordBadge } from "@/components/TrackRecordBadge";
import { ConfigWarning } from "@/components/ConfigWarning";
import { ConnectPrompt } from "@/components/ConnectPrompt";
import { useIncomingRequests, useMembership, useTools } from "@/hooks/useToolshed";
import { formatUsdc, plural } from "@/lib/format";

export default function LendPage() {
  const { isConnected } = useAccount();
  const { isMember, record } = useMembership();
  const { pending, open, myToolIds, isLoading } = useIncomingRequests();
  const { items } = useTools();

  const myTools = items.filter((i) => myToolIds.some((id) => id === i.id));

  if (!isConnected) {
    return <ConnectPrompt>Connect your wallet to list tools and answer borrow requests.</ConnectPrompt>;
  }

  return (
    <div className="flex flex-col gap-6">
      <ConfigWarning />

      <header>
        <h1 className="text-2xl font-semibold tracking-tight">My tools</h1>
        <div className="mt-1">
          <TrackRecordBadge record={record} />
        </div>
        {!isMember && (
          <p className="mt-2 text-sm text-amber-800">
            You are not on the association roster yet, so listing will be rejected. Ask the steward to add your
            address.
          </p>
        )}
      </header>

      <section>
        <h2 className="mb-2 text-lg font-semibold">
          Requests waiting on you {pending.length > 0 && <span className="text-shed-600">({pending.length})</span>}
        </h2>
        <p className="mb-3 text-sm text-shed-600">
          Most reliable borrowers first — the ones who bring things back on time are at the top.
        </p>
        {isLoading && <p className="text-sm text-shed-600">Loading…</p>}
        {!isLoading && pending.length === 0 && (
          <p className="card p-4 text-sm text-shed-600">Nothing waiting. Deposits are only held once someone asks.</p>
        )}
        <ul className="flex flex-col gap-3">
          {pending.map((item) => (
            <LoanRow key={item.id.toString()} item={item} role="owner" />
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Out with neighbours</h2>
        {open.length === 0 ? (
          <p className="card p-4 text-sm text-shed-600">Nothing of yours is on loan right now.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {open.map((item) => (
              <LoanRow key={item.id.toString()} item={item} role="owner" />
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Listed by me</h2>
        {myTools.length === 0 ? (
          <p className="card p-4 text-sm text-shed-600">You have not listed anything yet.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {myTools.map(({ id, tool, metadata }) => (
              <li key={id.toString()} className="card flex flex-wrap items-center gap-3 p-4">
                <div className="flex-1">
                  <p className="font-medium">{metadata?.name ?? `Tool #${id}`}</p>
                  <p className="text-sm text-shed-600">
                    {formatUsdc(tool.deposit)} deposit · {formatUsdc(tool.dailyLateFee)}/day late · up to{" "}
                    {tool.maxLoanDays} {plural(tool.maxLoanDays, "day")}
                    {tool.activeLoanId !== 0n && " · out on loan"}
                  </p>
                </div>
                <TxButton
                  functionName="setToolListed"
                  args={[id, !tool.listed]}
                  className="btn-secondary"
                  pendingLabel="Updating…"
                >
                  {tool.listed ? "Hide from browse" : "Show in browse"}
                </TxButton>
              </li>
            ))}
          </ul>
        )}
      </section>

      {isMember && <ListToolForm />}
    </div>
  );
}
