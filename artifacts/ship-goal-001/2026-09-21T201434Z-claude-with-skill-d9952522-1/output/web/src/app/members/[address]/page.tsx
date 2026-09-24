import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/core/db";
import { trackRecordFor } from "@/core/reputation";
import { listingsByOwner } from "@/core/listings";
import { loansFor } from "@/core/loans";
import { formatUsdc } from "@/core/chain";
import { TrackRecordBadge } from "@/components/TrackRecordBadge";

export const dynamic = "force-dynamic";

export default async function MemberPage({ params }: { params: Promise<{ address: string }> }) {
  const { address } = await params;
  const key = address.toLowerCase();

  const member = db().prepare("SELECT * FROM members WHERE address = ?").get(key) as
    | { address: string; display_name: string; unit: string | null; bio: string | null }
    | undefined;
  if (!member) notFound();

  const record = trackRecordFor(key);
  const listings = listingsByOwner(key);
  const history = loansFor(key).filter((l) => l.status === "settled");

  return (
    <>
      <h1>{member.display_name}</h1>
      <p className="sub">
        {member.unit ? `${member.unit} · ` : ""}
        <TrackRecordBadge record={record} />
      </p>
      {member.bio && <p>{member.bio}</p>}

      <h2>Tools they lend</h2>
      {listings.length === 0 ? (
        <p className="sub">Nothing listed.</p>
      ) : (
        <div className="grid">
          {listings.map((l) => (
            <Link href={`/listings/${l.id}`} className="card" key={l.id}>
              {l.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="card-photo" src={l.photoUrl} alt={l.title} />
              ) : (
                <div className="card-photo placeholder">no photo</div>
              )}
              <div className="card-body">
                <div className="card-title">{l.title}</div>
                <div className="card-meta">${formatUsdc(l.deposit)} deposit</div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <h2>Loan history</h2>
      {history.length === 0 ? (
        <p className="sub">No completed loans yet.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Tool</th>
              <th>Role</th>
              <th>Outcome</th>
              <th>Late fee</th>
            </tr>
          </thead>
          <tbody>
            {history.map((loan) => (
              <tr key={loan.loanId}>
                <td>{loan.listingTitle ?? `Loan #${loan.loanId}`}</td>
                <td>{loan.borrowerAddress === key ? "Borrowed" : "Lent"}</td>
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
      )}
    </>
  );
}
