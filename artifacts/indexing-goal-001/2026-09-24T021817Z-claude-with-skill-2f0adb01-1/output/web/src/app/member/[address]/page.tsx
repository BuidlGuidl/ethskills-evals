import Link from "next/link";
import { notFound } from "next/navigation";
import { isAddress } from "viem";
import { fetchMember } from "@/graphql/queries";
import {
  dayIndex,
  hasCheckedInToday,
  liveStreak,
  shortAddress,
} from "@/streak";

// Screen 2: per-member profile — current streak and all-time total.
export const dynamic = "force-dynamic";

export default async function MemberPage({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const { address } = await params;
  if (!isAddress(address)) notFound();

  const member = await fetchMember(address);

  if (!member) {
    return (
      <main>
        <h2 className="addr">{shortAddress(address)}</h2>
        <p className="muted">
          This address has never checked in. Nothing to show yet.
        </p>
      </main>
    );
  }

  const today = dayIndex();
  // The stored streak is a snapshot from the last check-in; `liveStreak`
  // zeroes it out once a day has actually been missed.
  const streak = liveStreak(member.streakAtLastCheckIn, member.lastDay, today);
  const checkedInToday = hasCheckedInToday(member.lastDay, today);

  return (
    <main>
      <h2 style={{ marginBottom: 4 }}>
        <span className="addr" style={{ fontFamily: "ui-monospace, monospace" }}>
          {shortAddress(member.address)}
        </span>
      </h2>
      <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
        Member since{" "}
        {new Date(member.firstCheckInAt * 1000).toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
          timeZone: "UTC",
        })}
      </p>

      <div className="stats">
        <div className="stat">
          <div className="value flame">
            {streak}
            {streak > 0 ? " 🔥" : ""}
          </div>
          <div className="label">Current streak</div>
        </div>
        <div className="stat">
          <div className="value">{member.totalCheckIns.toLocaleString()}</div>
          <div className="label">Check-ins all time</div>
        </div>
        <div className="stat">
          <div className="value">{member.longestStreak}</div>
          <div className="label">Longest streak</div>
        </div>
      </div>

      <p className="muted" style={{ fontSize: 13 }}>
        {checkedInToday
          ? "Checked in today."
          : streak > 0
            ? "Hasn't checked in yet today — the streak is still alive until midnight UTC."
            : "The streak is broken. A new check-in starts over at 1."}
      </p>

      <h3 style={{ marginTop: 32, fontSize: 15 }}>Recent check-ins</h3>
      <div>
        {member.recentCheckIns.map((c) => (
          <article className="row" key={c.id}>
            <div className="grow">
              <p className="note" style={{ marginTop: 0 }}>
                {c.note || <span className="empty-note">checked in</span>}
              </p>
              <div className="meta">
                {new Date(c.timestamp * 1000).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  timeZone: "UTC",
                })}
              </div>
            </div>
          </article>
        ))}
      </div>

      <p style={{ marginTop: 24 }}>
        <Link className="muted" href="/">
          ← Back to the feed
        </Link>
      </p>
    </main>
  );
}
