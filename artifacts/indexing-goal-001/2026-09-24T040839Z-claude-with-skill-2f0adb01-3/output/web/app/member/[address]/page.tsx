import { notFound } from "next/navigation";
import { getMemberProfile } from "../../../lib/queries";
import { shortAddress, timeAgo } from "../../../lib/streak";

export const revalidate = 5;

/**
 * Screen 2 — a member's profile: current streak (consecutive days) and
 * all-time total check-ins, both over the contract's complete history.
 */
export default async function MemberPage({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const { address } = await params;
  const profile = await getMemberProfile(address);
  if (!profile) notFound();

  return (
    <>
      <h1 className="mono">{shortAddress(profile.address)}</h1>
      <p className="sub">
        First check-in {timeAgo(profile.firstCheckInAt)} · last {timeAgo(profile.lastCheckInAt)}
      </p>

      <div className="stats">
        <div>
          <div className="stat-value">{profile.currentStreak}</div>
          <div className="muted">day streak</div>
        </div>
        <div>
          <div className="stat-value">{profile.totalCheckIns}</div>
          <div className="muted">all-time check-ins</div>
        </div>
        <div>
          <div className="stat-value">{profile.longestStreak}</div>
          <div className="muted">longest streak</div>
        </div>
      </div>

      <h2 style={{ fontSize: "1rem" }}>Recent check-ins</h2>
      <ul>
        {profile.recentCheckIns.map((c) => (
          <li key={c.id}>
            <div className="row">
              <span className="grow">{c.note || <em className="muted">checked in</em>}</span>
              <span className="muted">{timeAgo(c.timestamp)}</span>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
