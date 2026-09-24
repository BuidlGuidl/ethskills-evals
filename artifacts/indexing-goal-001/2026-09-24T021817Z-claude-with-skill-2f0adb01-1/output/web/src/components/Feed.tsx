"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckInRow } from "./CheckInRow";
import type { FeedCheckIn } from "@/graphql/queries";

const POLL_MS = 15_000;

/**
 * The live global feed.
 *
 * Seeded with a server-rendered first page (so history is on screen
 * immediately, no loading spinner), then kept live by polling /api/feed — our
 * own route, not the subgraph directly, so the gateway API key stays server-side.
 *
 * Polling, not a websocket subscription: a subscription would only ever deliver
 * check-ins that happen while the tab is open, and this feed has to show
 * months of prior history regardless. One source of truth (the indexer) beats
 * stitching a backfill onto a live stream.
 */
export function Feed({
  initial,
  initialCursor,
}: {
  initial: FeedCheckIn[];
  initialCursor: string | null;
}) {
  const [checkIns, setCheckIns] = useState(initial);
  const [cursor, setCursor] = useState(initialCursor);
  const [loadingMore, setLoadingMore] = useState(false);

  // Poll the head of the feed and merge anything new in front.
  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch("/api/feed?first=25", { cache: "no-store" });
        if (!res.ok) return;
        const { checkIns: fresh, nextCursor } = (await res.json()) as {
          checkIns: FeedCheckIn[];
          nextCursor: string | null;
        };
        if (cancelled) return;
        setCheckIns((current) => {
          const seen = new Set(current.map((c) => c.id));
          const added = fresh.filter((c) => !seen.has(c.id));
          if (added.length === 0) return current;
          // If the whole poll page is new, more may have landed than we asked
          // for and prepending would leave an invisible hole in the feed.
          // Start over from this page instead — its cursor is consistent.
          if (added.length === fresh.length) {
            setCursor(nextCursor);
            return fresh;
          }
          return [...added, ...current];
        });
      } catch {
        // A failed poll is not worth interrupting the page for; the next
        // tick will pick things up.
      }
    }

    const timer = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const loadMore = useCallback(async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await fetch(`/api/feed?first=50&cursor=${cursor}`, {
        cache: "no-store",
      });
      if (res.ok) {
        const page = (await res.json()) as {
          checkIns: FeedCheckIn[];
          nextCursor: string | null;
        };
        setCheckIns((current) => {
          const seen = new Set(current.map((c) => c.id));
          return [...current, ...page.checkIns.filter((c) => !seen.has(c.id))];
        });
        setCursor(page.nextCursor);
      }
    } finally {
      setLoadingMore(false);
    }
  }, [cursor, loadingMore]);

  if (checkIns.length === 0) {
    return <p className="muted">No check-ins yet. Be the first.</p>;
  }

  return (
    <>
      <div>
        {checkIns.map((checkIn) => (
          <CheckInRow key={checkIn.id} checkIn={checkIn} />
        ))}
      </div>
      {cursor ? (
        <p style={{ marginTop: 20 }}>
          <button className="ghost" onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? "Loading…" : "Load older check-ins"}
          </button>
        </p>
      ) : (
        <p className="muted" style={{ marginTop: 20, fontSize: 13 }}>
          That&rsquo;s the whole history, back to the first check-in.
        </p>
      )}
    </>
  );
}
