import Link from "next/link";

import {formatUsdc} from "@/core/loan.ts";
import {reliabilityLabel, type TrackRecord} from "@/core/reputation.ts";

/**
 * The track-record badge. It appears next to every member's name, on the browse screen, on an
 * owner's request queue, and on the member page, and always says the same thing in the same
 * shape — the whole point of the reputation system is that it is legible at a glance.
 */
export function RecordBadge({record, role}: {record: TrackRecord; role: "owner" | "borrower"}) {
  const {loansBorrowed, lateReturns, forfeits} = record;
  const label = reliabilityLabel(record);

  const tone =
    loansBorrowed === 0
      ? "bg-stone-100 text-stone-600"
      : forfeits > 0 || lateReturns * 2 > loansBorrowed
        ? "bg-red-50 text-red-800"
        : lateReturns > 0
          ? "bg-amber-50 text-amber-900"
          : "bg-emerald-50 text-emerald-900";

  const detail =
    loansBorrowed === 0
      ? role === "owner"
        ? `${record.loansLent} lent out`
        : "no borrowing history yet"
      : `${loansBorrowed} borrowed · ${lateReturns} late${forfeits > 0 ? ` · ${forfeits} never returned` : ""}`;

  return (
    <span className={`inline-flex items-baseline gap-2 rounded-full px-3 py-1 text-xs ${tone}`}>
      <strong className="font-semibold">{label}</strong>
      <span className="opacity-80">{detail}</span>
    </span>
  );
}

export function MemberLink({
  address,
  name,
}: {
  address: string;
  name: string | null;
}) {
  return (
    <Link className="font-medium text-stone-900 underline-offset-2 hover:underline" href={`/members/${address}`}>
      {name ?? `${address.slice(0, 6)}…${address.slice(-4)}`}
    </Link>
  );
}

export function Usdc({amount, className}: {amount: bigint; className?: string}) {
  return (
    <span className={className}>
      {formatUsdc(amount)} <span className="text-stone-500">USDC</span>
    </span>
  );
}

export function Empty({children}: {children: React.ReactNode}) {
  return (
    <p className="rounded-lg border border-dashed border-stone-300 bg-white p-8 text-center text-stone-500">
      {children}
    </p>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-stone-800">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-stone-500">{hint}</span> : null}
    </label>
  );
}
