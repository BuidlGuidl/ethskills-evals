import Link from "next/link";
import { getLeaderboard } from "../../lib/queries";
import { currentMonthKey, shortAddress } from "../../lib/streak";

export const revalidate = 30;

/** Screen 3 — top members this calendar month (UTC) by number of check-ins. */
export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month = currentMonthKey() } = await searchParams;
  const rows = await getLeaderboard({ month, first: 25 });

  return (
    <>
      <h1>Leaderboard</h1>
      <p className="sub">Most check-ins in {month} (UTC).</p>

      {rows.length === 0 && <p className="muted">No check-ins this month yet.</p>}
      <ul>
        {rows.map((row) => (
          <li key={row.address}>
            <div className="row">
              <span className="rank">{row.rank}</span>
              <Link href={`/member/${row.address}`} className="mono grow note-member">
                {shortAddress(row.address)}
              </Link>
              <span>{row.checkIns} this month</span>
              <span className="muted">{row.currentStreak}d streak</span>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
