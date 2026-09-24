"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { shortAddress, timeAgo } from "@/streak";
import type { FeedCheckIn } from "@/graphql/queries";

/**
 * One feed row: who, when, and their note. Rendered client-side so the "when"
 * can tick without a refetch — the underlying data is still whatever the
 * server handed us.
 */
export function CheckInRow({ checkIn }: { checkIn: FeedCheckIn }) {
  return (
    <article className="row">
      <div className="grow">
        <Link className="who" href={`/member/${checkIn.memberAddress}`}>
          {shortAddress(checkIn.memberAddress)}
        </Link>
        <p className="note">
          {checkIn.note ? (
            checkIn.note
          ) : (
            <span className="empty-note">checked in</span>
          )}
        </p>
        <div className="meta">
          <RelativeTime unixSeconds={checkIn.timestamp} /> · day {checkIn.streak} of
          their streak
        </div>
      </div>
    </article>
  );
}

/**
 * Renders the absolute timestamp on the server pass and switches to a relative
 * one after hydration — formatting "3m ago" during SSR would bake the server's
 * clock into the HTML and trip a hydration mismatch.
 */
function RelativeTime({ unixSeconds }: { unixSeconds: number }) {
  const [label, setLabel] = useState<string>(() =>
    new Date(unixSeconds * 1000).toISOString().replace("T", " ").slice(0, 16) + " UTC"
  );

  useEffect(() => {
    const update = () => setLabel(timeAgo(unixSeconds));
    update();
    const timer = setInterval(update, 30_000);
    return () => clearInterval(timer);
  }, [unixSeconds]);

  return <time dateTime={new Date(unixSeconds * 1000).toISOString()}>{label}</time>;
}
