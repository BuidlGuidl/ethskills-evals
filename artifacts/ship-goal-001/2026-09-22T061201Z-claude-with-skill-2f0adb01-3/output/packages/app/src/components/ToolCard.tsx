"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { TxButton } from "./TxButton";
import { ConnectButton } from "./ConnectButton";
import { TrackRecordBadge } from "./TrackRecordBadge";
import { toolshedAddress, usdc } from "@/lib/contracts";
import { formatUsdc, plural } from "@/lib/format";
import { resolveUri } from "@/lib/metadata";
import { useChainNow, useUsdcAllowance, useUsdcBalance, type ToolWithRecord } from "@/hooks/useToolshed";

export function ToolCard({ item, isMember }: { item: ToolWithRecord; isMember: boolean }) {
  const { address, isConnected } = useAccount();
  const { tool, id, ownerRecord, metadata } = item;
  const [asking, setAsking] = useState(false);

  const isMine = !!address && address.toLowerCase() === tool.owner.toLowerCase();
  const out = tool.activeLoanId !== 0n;
  // The contract refuses loans of a suspended member's tools; say so instead of letting the
  // borrow button revert.
  const ownerSuspended = !ownerRecord.active;
  const photo = resolveUri(metadata?.image ?? "");

  return (
    <article className="card flex flex-col overflow-hidden">
      <div className="flex h-40 items-center justify-center bg-shed-100">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element -- member-supplied IPFS/https URLs
          <img src={photo} alt={metadata?.name ?? `Tool ${id}`} className="h-40 w-full object-cover" />
        ) : (
          <span className="text-4xl opacity-40">🔧</span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold leading-tight">{metadata?.name ?? `Tool #${id}`}</h3>
          {out && <span className="rounded-full bg-shed-100 px-2 py-0.5 text-xs text-shed-600">Out on loan</span>}
        </div>

        {metadata?.condition && <p className="text-sm text-shed-600">{metadata.condition}</p>}

        <dl className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
          <dt className="text-shed-600">Deposit</dt>
          <dd className="text-right font-medium">{formatUsdc(tool.deposit)}</dd>
          <dt className="text-shed-600">Late fee</dt>
          <dd className="text-right font-medium">{formatUsdc(tool.dailyLateFee)}/day</dd>
          <dt className="text-shed-600">Up to</dt>
          <dd className="text-right font-medium">
            {tool.maxLoanDays} {plural(tool.maxLoanDays, "day")}
          </dd>
        </dl>

        <div className="mt-2 border-t border-shed-100 pt-2">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-shed-600">Owner</p>
          <TrackRecordBadge record={ownerRecord} address={tool.owner} as="owner" />
        </div>

        <div className="mt-auto pt-3">
          {isMine ? (
            <p className="text-xs text-shed-600">Your tool.</p>
          ) : out ? (
            <p className="text-xs text-shed-600">Borrowed right now — check back when it&apos;s returned.</p>
          ) : ownerSuspended ? (
            <p className="text-xs text-shed-600">
              The owner is not on the roster at the moment, so this one can&apos;t be borrowed.
            </p>
          ) : !isConnected ? (
            <ConnectButton label="Connect wallet to borrow" />
          ) : !isMember ? (
            <p className="text-xs text-shed-600">Association members only. Ask the steward to add you.</p>
          ) : asking ? (
            <BorrowForm item={item} onCancel={() => setAsking(false)} />
          ) : (
            <button className="btn-primary w-full" onClick={() => setAsking(true)}>
              Ask to borrow
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

/**
 * Two-step deposit flow: approve exactly this deposit, then request. We never ask for an
 * unlimited allowance — the contract only ever needs the deposit in front of it.
 */
function BorrowForm({ item, onCancel }: { item: ToolWithRecord; onCancel: () => void }) {
  const { tool, id } = item;
  const [days, setDays] = useState(Math.min(3, tool.maxLoanDays));
  const allowance = useUsdcAllowance();
  const balance = useUsdcBalance();
  const now = useChainNow();

  const approved = ((allowance.data as bigint | undefined) ?? 0n) >= tool.deposit;
  // Only claim they are short once we have actually read the balance.
  const shortOfFunds = balance.isSuccess && (balance.data as bigint) < tool.deposit;
  // Due dates are judged by block time, so preview them with the chain's clock.
  const dueDate = new Date((now + days * 86_400) * 1000);

  return (
    <div className="flex flex-col gap-2">
      <label className="block">
        <span className="label">How many days?</span>
        <input
          className="input"
          type="number"
          min={1}
          max={tool.maxLoanDays}
          value={days}
          onChange={(e) => {
            const next = Number(e.target.value);
            if (Number.isFinite(next)) setDays(Math.max(1, Math.min(tool.maxLoanDays, Math.floor(next))));
          }}
        />
      </label>

      <p className="text-xs text-shed-600">
        Due {dueDate.toLocaleDateString()} if the owner approves today. After that, {formatUsdc(tool.dailyLateFee)} a
        day comes out of your {formatUsdc(tool.deposit)} deposit and goes to the owner — never more than the deposit
        itself.
      </p>

      {shortOfFunds ? (
        <p className="text-xs text-red-700">
          You need {formatUsdc(tool.deposit)} to cover the deposit. Top up your wallet first.
        </p>
      ) : !approved ? (
        <TxButton
          contract={usdc}
          functionName="approve"
          args={[toolshedAddress, tool.deposit]}
          pendingLabel="Approving USDC…"
        >
          1 · Approve {formatUsdc(tool.deposit)}
        </TxButton>
      ) : (
        <TxButton functionName="requestLoan" args={[id, days]} pendingLabel="Sending request…" onDone={onCancel}>
          2 · Put down {formatUsdc(tool.deposit)} and ask
        </TxButton>
      )}

      <button className="btn-ghost text-xs" onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}
