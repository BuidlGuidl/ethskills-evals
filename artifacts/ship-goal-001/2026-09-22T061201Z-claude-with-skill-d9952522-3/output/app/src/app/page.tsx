import Link from "next/link";

import {browse} from "@/server/listings.ts";
import {migrate} from "@/server/db.ts";
import {Empty, RecordBadge, Usdc} from "@/components/ui.tsx";
import {relativeTime} from "@/core/loan.ts";

export const dynamic = "force-dynamic";

/**
 * Browse.
 *
 * Ordered by the owner's track record, so the members who actually hold up their end of the deal
 * are the first tools you see. The ranking is computed in `src/server/listings.ts` from indexed
 * loan events — there is no score stored onchain and nothing to keep in sync.
 */
export default async function BrowsePage({
  searchParams,
}: {
  searchParams: Promise<{q?: string}>;
}) {
  migrate();
  const {q} = await searchParams;
  const listings = browse({search: q});
  const now = BigInt(Math.floor(Date.now() / 1000));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tools in the shed</h1>
          <p className="mt-1 text-sm text-stone-600">
            Sorted by the owner&apos;s track record. Put down the deposit in USDC, get it back
            when you bring the tool home.
          </p>
        </div>
        <Link href="/tools/new" className="btn-primary">
          List a tool
        </Link>
      </div>

      <form className="flex gap-2" action="/">
        <input
          className="input"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search for a drill, a ladder, a wheelbarrow…"
        />
        <button className="btn-secondary" type="submit">
          Search
        </button>
      </form>

      {listings.length === 0 ? (
        <Empty>
          {q
            ? `Nothing in the shed matches “${q}”.`
            : "Nothing listed yet. Be the first — list a tool you would not mind lending."}
        </Empty>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {listings.map((listing) => (
            <li key={listing.id}>
              <Link href={`/tools/${listing.id}`} className="card block h-full transition hover:border-stone-400">
                {listing.photoPath ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={listing.photoPath}
                    alt={listing.title}
                    className="mb-4 h-44 w-full rounded-md object-cover"
                  />
                ) : (
                  <div className="mb-4 flex h-44 w-full items-center justify-center rounded-md bg-stone-100 text-sm text-stone-400">
                    no photo
                  </div>
                )}

                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-base font-semibold">{listing.title}</h2>
                  {listing.outOnLoanUntil !== null ? (
                    <span className="shrink-0 rounded-full bg-stone-100 px-2 py-1 text-xs text-stone-600">
                      out · due {relativeTime(BigInt(listing.outOnLoanUntil), now)}
                    </span>
                  ) : null}
                </div>

                {listing.conditionNotes ? (
                  <p className="mt-1 line-clamp-2 text-sm text-stone-600">{listing.conditionNotes}</p>
                ) : null}

                <p className="mt-3 text-sm text-stone-700">
                  <Usdc amount={listing.deposit} className="font-medium" /> deposit ·{" "}
                  <Usdc amount={listing.dailyLateFee} /> a day if it is late
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-stone-100 pt-3">
                  <span className="text-sm text-stone-600">{listing.ownerName}</span>
                  <RecordBadge record={listing.ownerRecord} role="owner" />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
