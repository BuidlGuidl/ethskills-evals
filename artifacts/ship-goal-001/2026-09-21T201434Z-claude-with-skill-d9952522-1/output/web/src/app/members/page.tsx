import Link from "next/link";
import { allTrackRecords } from "@/core/reputation";
import { TrackRecordBadge } from "@/components/TrackRecordBadge";

export const dynamic = "force-dynamic";

export default async function MembersPage() {
  const members = [...allTrackRecords().values()].sort((a, b) => b.score - a.score);

  return (
    <>
      <h1>Neighbors</h1>
      <p className="sub">
        Every number here is computed from what actually happened onchain. Nobody can edit their own record.
      </p>

      <table>
        <thead>
          <tr>
            <th>Member</th>
            <th>Borrowed</th>
            <th>Late</th>
            <th>Lent</th>
            <th>Track record</th>
          </tr>
        </thead>
        <tbody>
          {members.map((m) => (
            <tr key={m.address}>
              <td>
                <Link href={`/members/${m.address}`}>{m.displayName ?? m.address.slice(0, 12)}</Link>
              </td>
              <td>{m.loansBorrowed}</td>
              <td>{m.lateReturns}</td>
              <td>{m.loansLent}</td>
              <td>
                <TrackRecordBadge record={m} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
