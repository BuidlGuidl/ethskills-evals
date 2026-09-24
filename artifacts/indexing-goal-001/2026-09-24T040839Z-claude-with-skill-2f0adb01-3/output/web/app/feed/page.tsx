import Link from "next/link";
import { getFeed } from "../../lib/queries";
import { shortAddress, timeAgo } from "../../lib/streak";
import { AutoRefresh } from "../../components/AutoRefresh";
import { CheckInButton } from "../../components/CheckInButton";

export const revalidate = 5;

/**
 * Screen 1 — the live global feed: most recent check-ins across everyone,
 * newest first, reaching back to the contract's first day.
 */
export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<{ before?: string }>;
}) {
  const { before } = await searchParams;
  const feed = await getFeed({ first: 50, cursor: before });
  const last = feed.at(-1);

  return (
    <>
      <AutoRefresh />
      <h1>Feed</h1>
      <p className="sub">Everyone&apos;s check-ins, newest first.</p>
      <CheckInButton />

      {feed.length === 0 && <p className="muted">No check-ins yet.</p>}
      <ul>
        {feed.map((c) => (
          <li key={c.id}>
            <div className="row">
              <Link href={`/member/${c.member.id}`} className="mono note-member">
                {shortAddress(c.member.id)}
              </Link>
              <span className="grow">{c.note || <em className="muted">checked in</em>}</span>
              <span className="muted">{timeAgo(c.timestamp)}</span>
            </div>
            <div className="muted">
              day {c.streakAtCheckIn} of their streak · {c.member.totalCheckIns} all-time
            </div>
          </li>
        ))}
      </ul>

      {last && feed.length === 50 && (
        <p style={{ marginTop: "1.5rem" }}>
          <Link href={`/feed?before=${last.sequence}`}>Older →</Link>
        </p>
      )}
    </>
  );
}
