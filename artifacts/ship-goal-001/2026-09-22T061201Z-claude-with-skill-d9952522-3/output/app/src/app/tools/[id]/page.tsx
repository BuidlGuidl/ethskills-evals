import {notFound} from "next/navigation";

import {getListing, isOnLoan} from "@/server/listings.ts";
import {trackRecord} from "@/server/members.ts";
import {currentMember} from "@/server/members.ts";
import {migrate} from "@/server/db.ts";
import {MemberLink, RecordBadge, Usdc} from "@/components/ui.tsx";
import {RequestForm} from "./request-form.tsx";

export const dynamic = "force-dynamic";

export default async function ToolPage({params}: {params: Promise<{id: string}>}) {
  migrate();
  const {id} = await params;
  const listing = getListing(id);
  if (!listing) notFound();

  const owner = trackRecord(listing.ownerAddress);
  const me = await currentMember();
  const onLoan = isOnLoan(listing.id);
  const isMine = me?.address === listing.ownerAddress;

  return (
    <div className="grid gap-8 lg:grid-cols-[3fr_2fr]">
      <div className="space-y-4">
        {listing.photoPath ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={listing.photoPath}
            alt={listing.title}
            className="w-full rounded-lg border border-stone-200 object-cover"
          />
        ) : null}

        <h1 className="text-2xl font-semibold tracking-tight">{listing.title}</h1>

        {listing.description ? (
          <p className="whitespace-pre-line text-stone-700">{listing.description}</p>
        ) : null}

        {listing.conditionNotes ? (
          <div className="card">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
              Condition
            </h2>
            <p className="mt-2 whitespace-pre-line text-stone-700">{listing.conditionNotes}</p>
          </div>
        ) : null}
      </div>

      <aside className="space-y-4">
        <div className="card space-y-3">
          <div>
            <p className="text-sm text-stone-500">Lent by</p>
            <p className="mt-1">
              <MemberLink address={listing.ownerAddress} name={owner.displayName} />
            </p>
            <div className="mt-2">
              <RecordBadge record={owner} role="owner" />
            </div>
          </div>

          <dl className="space-y-1 border-t border-stone-100 pt-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-stone-500">Deposit</dt>
              <dd>
                <Usdc amount={listing.deposit} className="font-medium" />
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-stone-500">Late fee</dt>
              <dd>
                <Usdc amount={listing.dailyLateFee} /> / day
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-stone-500">Longest loan</dt>
              <dd>{listing.maxDays} days</dd>
            </div>
          </dl>

          <p className="border-t border-stone-100 pt-3 text-xs text-stone-500">
            The deposit sits in escrow, not in the owner&apos;s pocket. Bring the tool back on
            time and all of it comes back to you. Every started day late moves{" "}
            {listing.dailyLateFee > 0n ? <Usdc amount={listing.dailyLateFee} /> : null} of it to
            the owner, up to the whole deposit.
          </p>
        </div>

        {isMine ? (
          <p className="card text-sm text-stone-600">This is your tool.</p>
        ) : onLoan ? (
          <p className="card text-sm text-stone-600">
            Out on loan at the moment. Ask anyway if you like — the owner can approve you for when
            it comes back.
          </p>
        ) : null}

        {!isMine && listing.status === "available" ? (
          <RequestForm listingId={listing.id} maxDays={listing.maxDays} signedIn={Boolean(me)} />
        ) : null}
      </aside>
    </div>
  );
}
