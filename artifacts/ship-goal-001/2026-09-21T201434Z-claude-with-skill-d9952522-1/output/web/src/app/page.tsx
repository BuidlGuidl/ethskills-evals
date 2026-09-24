import Link from "next/link";
import { browseListings, type BrowseSort } from "@/core/listings";
import { formatUsdc } from "@/core/chain";
import { TrackRecordBadge } from "@/components/TrackRecordBadge";

export const dynamic = "force-dynamic";

const SORTS: { key: BrowseSort; label: string }[] = [
  { key: "trust", label: "Track record" },
  { key: "newest", label: "Recently added" },
  { key: "deposit", label: "Lowest deposit" },
];

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; q?: string }>;
}) {
  const { sort = "trust", q } = await searchParams;
  const listings = browseListings({ sort: sort as BrowseSort, search: q });

  return (
    <>
      <h1>Borrow from a neighbor</h1>
      <p className="sub">
        Sorted by the owner&rsquo;s track record, so the people who show up for the association show up first.
      </p>

      <form className="toolbar" method="get">
        <input type="search" name="q" placeholder="Search tools…" defaultValue={q ?? ""} />
        <select name="sort" defaultValue={sort}>
          {SORTS.map((s) => (
            <option key={s.key} value={s.key}>
              Sort: {s.label}
            </option>
          ))}
        </select>
        <button type="submit" className="secondary">
          Apply
        </button>
      </form>

      {listings.length === 0 ? (
        <div className="panel">
          <p style={{ margin: 0 }}>
            Nothing listed yet. <Link href="/listings/new">Lend a tool</Link> to get the shed started.
          </p>
        </div>
      ) : (
        <div className="grid">
          {listings.map((listing) => (
            <Link key={listing.id} href={`/listings/${listing.id}`} className="card">
              {listing.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="card-photo" src={listing.photoUrl} alt={listing.title} />
              ) : (
                <div className="card-photo placeholder">no photo</div>
              )}
              <div className="card-body">
                <div className="card-title">{listing.title}</div>
                <div className="card-meta">
                  ${formatUsdc(listing.deposit)} deposit · ${formatUsdc(listing.dailyLateFee)}/day late · up to{" "}
                  {listing.maxDays} days
                </div>
                <div className="card-meta">{listing.owner.displayName ?? listing.ownerAddress.slice(0, 10)}</div>
                <div className="card-foot">
                  <TrackRecordBadge record={listing.owner} />
                  {listing.onLoan && <span className="badge out">Out now</span>}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
