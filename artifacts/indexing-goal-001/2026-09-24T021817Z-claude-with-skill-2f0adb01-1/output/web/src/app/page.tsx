import { Feed } from "@/components/Feed";
import { CheckInButton } from "@/components/CheckInButton";
import { fetchFeed, fetchGlobalStats } from "@/graphql/queries";
import { SubgraphWarning } from "@/components/SubgraphWarning";

// Screen 1: the live global feed. Server-rendered first page, then polled.
export const dynamic = "force-dynamic";

export default async function FeedPage() {
  const [page, stats] = await Promise.all([
    fetchFeed({ first: 50 }),
    fetchGlobalStats(),
  ]);

  return (
    <main>
      <SubgraphWarning />
      <div className="stats">
        <div className="stat">
          <div className="value">{stats.totalCheckIns.toLocaleString()}</div>
          <div className="label">Check-ins all time</div>
        </div>
        <div className="stat">
          <div className="value">{stats.totalMembers.toLocaleString()}</div>
          <div className="label">Members</div>
        </div>
      </div>

      <CheckInButton />

      <Feed initial={page.checkIns} initialCursor={page.nextCursor} />
    </main>
  );
}
