import Link from "next/link";
import { notFound } from "next/navigation";
import { getListing } from "@/core/listings";
import { loansForListing } from "@/core/loans";
import { formatUsdc } from "@/core/chain";
import { TrackRecordBadge } from "@/components/TrackRecordBadge";
import { BorrowPanel } from "@/components/BorrowPanel";

export const dynamic = "force-dynamic";

export default async function ListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const listing = getListing(id);
  if (!listing) notFound();

  const history = loansForListing(id).filter((l) => l.status === "settled");

  return (
    <>
      <p className="sub">
        <Link href="/">← Back to browse</Link>
      </p>

      <div className="detail">
        <div>
          {listing.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={listing.photoUrl}
              alt={listing.title}
              style={{ width: "100%", borderRadius: 10, border: "1px solid var(--line)" }}
            />
          ) : (
            <div className="panel" style={{ textAlign: "center", color: "var(--muted)" }}>
              No photo
            </div>
          )}

          <h1 style={{ marginTop: 18 }}>{listing.title}</h1>
          <p className="sub" style={{ marginBottom: 12 }}>
            Lent by{" "}
            <Link href={`/members/${listing.ownerAddress}`}>
              {listing.owner.displayName ?? listing.ownerAddress}
            </Link>{" "}
            <TrackRecordBadge record={listing.owner} />
          </p>

          {listing.description && <p>{listing.description}</p>}

          {listing.conditionNote && (
            <>
              <h2>Condition</h2>
              <p style={{ marginTop: 0 }}>{listing.conditionNote}</p>
            </>
          )}
        </div>

        <div className="panel">
          <ul className="terms">
            <li>
              <span>Deposit</span>
              <span>${formatUsdc(listing.deposit)} USDC</span>
            </li>
            <li>
              <span>Late fee</span>
              <span>${formatUsdc(listing.dailyLateFee)} per day</span>
            </li>
            <li>
              <span>Maximum loan</span>
              <span>{listing.maxDays} days</span>
            </li>
          </ul>

          <BorrowPanel
            listingId={listing.id}
            listingRef={listing.listingRef}
            ownerAddress={listing.ownerAddress}
            deposit={listing.deposit}
            dailyLateFee={listing.dailyLateFee}
            maxDays={listing.maxDays}
            disabled={listing.onLoan || !listing.available}
            disabledReason={
              listing.onLoan ? "Already out with another neighbor." : "The owner has paused this listing."
            }
          />
        </div>
      </div>

      {history.length > 0 && (
        <>
          <h2>This tool&rsquo;s history</h2>
          <table>
            <thead>
              <tr>
                <th>Borrower</th>
                <th>Returned</th>
                <th>Late fee</th>
              </tr>
            </thead>
            <tbody>
              {history.map((loan) => (
                <tr key={loan.loanId}>
                  <td>
                    <Link href={`/members/${loan.borrowerAddress}`}>
                      {loan.borrower.displayName ?? loan.borrowerAddress.slice(0, 10)}
                    </Link>
                  </td>
                  <td>
                    {loan.unreturned
                      ? "Never returned"
                      : loan.daysLate && loan.daysLate > 0
                        ? `${loan.daysLate} ${loan.daysLate === 1 ? "day" : "days"} late`
                        : "On time"}
                  </td>
                  <td>${formatUsdc(loan.lateFeePaid ?? "0")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </>
  );
}
