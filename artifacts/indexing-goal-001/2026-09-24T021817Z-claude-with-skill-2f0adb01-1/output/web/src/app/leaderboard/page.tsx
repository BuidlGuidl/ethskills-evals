import Link from "next/link";
import { fetchLeaderboard, fetchMonths } from "@/graphql/queries";
import { dayIndex, liveStreak, monthKey, monthLabel, shortAddress } from "@/streak";
import { SubgraphWarning } from "@/components/SubgraphWarning";

// Screen 3: top members this month by number of check-ins.
// `?month=YYYY-MM` browses any past month — the indexer has them all.
export const dynamic = "force-dynamic";

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month: requested } = await searchParams;
  const month = /^\d{4}-\d{2}$/.test(requested ?? "") ? requested! : monthKey();

  const [board, months] = await Promise.all([
    fetchLeaderboard({ month, first: 50 }),
    fetchMonths(),
  ]);
  const today = dayIndex();

  return (
    <main>
      <SubgraphWarning />
      <h2 style={{ marginBottom: 4 }}>{monthLabel(month)}</h2>
      <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
        {board.totals.checkIns.toLocaleString()} check-ins from{" "}
        {board.totals.activeMembers.toLocaleString()} members this month.
      </p>

      {months.length > 1 && (
        <nav className="month-switch">
          {months.map((m) => (
            <Link key={m} href={`/leaderboard?month=${m}`} className={m === month ? "on" : ""}>
              {monthLabel(m)}
            </Link>
          ))}
        </nav>
      )}

      {board.rows.length === 0 ? (
        <p className="muted">No check-ins in this month.</p>
      ) : (
        <table className="lb">
          <thead>
            <tr>
              <th />
              <th>Member</th>
              <th style={{ textAlign: "right" }}>This month</th>
              <th style={{ textAlign: "right" }}>Streak</th>
              <th style={{ textAlign: "right" }}>All time</th>
            </tr>
          </thead>
          <tbody>
            {board.rows.map((row) => (
              <tr key={row.address}>
                <td className="rank">{row.rank}</td>
                <td>
                  <Link className="addr" href={`/member/${row.address}`}>
                    {shortAddress(row.address)}
                  </Link>
                </td>
                <td className="num">{row.checkIns}</td>
                <td className="num">
                  {liveStreak(row.streakAtLastCheckIn, row.lastDay, today)}
                </td>
                <td className="num muted">{row.totalCheckIns.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
