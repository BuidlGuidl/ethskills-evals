import Link from "next/link";
import {notFound} from "next/navigation";

import {getMember, trackRecord} from "@/server/members.ts";
import {listingsByOwner} from "@/server/listings.ts";
import {loansForMember} from "@/server/loans.ts";
import {migrate} from "@/server/db.ts";
import {RecordBadge, Usdc} from "@/components/ui.tsx";
import {formatUsdc} from "@/core/loan.ts";

export const dynamic = "force-dynamic";

/**
 * A member's track record.
 *
 * Every number on this page is derived from settled loans the escrow emitted — nothing here is
 * self-reported, and nothing can be edited by the member it describes. That is the whole reason
 * the counts are worth anything when an owner is deciding who to lend a chainsaw to.
 */
export default async function MemberPage({params}: {params: Promise<{address: string}>}) {
  migrate();
  const {address} = await params;
  const member = getMember(address);
  if (!member) notFound();

  const record = trackRecord(member.address);
  const listings = listingsByOwner(member.address).filter((l) => l.status === "available");
  const history = loansForMember(member.address).filter((loan) => loan.status === "closed");

  const stats = [
    {label: "Loans borrowed", value: String(record.loansBorrowed)},
    {label: "Returned late", value: String(record.lateReturns)},
    {label: "Total days late", value: String(record.lateDaysTotal)},
    {label: "Never returned", value: String(record.forfeits)},
    {label: "Tools lent out", value: String(record.loansLent)},
    {label: "Late fees earned", value: `${formatUsdc(record.lateFeesEarned)} USDC`},
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{member.displayName}</h1>
        {member.unitLabel ? <p className="text-stone-600">{member.unitLabel}</p> : null}
        <p className="mt-1 font-mono text-xs text-stone-400">{member.address}</p>
        <div className="mt-3">
          <RecordBadge record={record} role="borrower" />
        </div>
        {member.bio ? <p className="mt-4 max-w-2xl text-stone-700">{member.bio}</p> : null}
      </div>

      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {stats.map((stat) => (
          <div key={stat.label} className="card">
            <dt className="text-xs uppercase tracking-wide text-stone-500">{stat.label}</dt>
            <dd className="mt-1 text-xl font-semibold">{stat.value}</dd>
          </div>
        ))}
      </dl>

      {record.loansOutstanding > 0 ? (
        <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">
          Currently has {record.loansOutstanding} tool
          {record.loansOutstanding === 1 ? "" : "s"} out on loan.
        </p>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Tools they lend</h2>
        {listings.length === 0 ? (
          <p className="text-sm text-stone-500">Nothing listed at the moment.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {listings.map((listing) => (
              <li key={listing.id} className="card">
                <Link href={`/tools/${listing.id}`} className="font-medium hover:underline">
                  {listing.title}
                </Link>
                <p className="mt-1 text-sm text-stone-600">
                  <Usdc amount={listing.deposit} /> deposit
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Settled loans</h2>
        {history.length === 0 ? (
          <p className="text-sm text-stone-500">No settled loans yet.</p>
        ) : (
          <ul className="divide-y divide-stone-200 rounded-lg border border-stone-200 bg-white">
            {history.slice(0, 25).map((loan) => (
              <li key={loan.loanId} className="flex flex-wrap items-center justify-between gap-2 p-4 text-sm">
                <span>
                  {loan.borrowerAddress === member.address ? "Borrowed" : "Lent"}{" "}
                  {loan.listingTitle ?? "a tool"}
                </span>
                <span className={loan.lateDays && loan.lateDays > 0 ? "text-red-700" : "text-stone-600"}>
                  {loan.outcome === "forfeited"
                    ? "never returned"
                    : loan.lateDays && loan.lateDays > 0
                      ? `${loan.lateDays} day${loan.lateDays === 1 ? "" : "s"} late`
                      : "on time"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
