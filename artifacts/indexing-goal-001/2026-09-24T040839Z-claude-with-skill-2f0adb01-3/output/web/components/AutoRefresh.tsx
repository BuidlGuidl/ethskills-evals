"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Keeps a server-rendered page live by re-fetching it on an interval.
 *
 * The feed reads from the subgraph rather than from a websocket log
 * subscription, so that one code path serves both the months of history behind
 * the app and whatever landed ten seconds ago. Polling the indexer keeps those
 * consistent; a socket tail would show events the indexer has not folded into
 * streaks and leaderboards yet.
 */
export function AutoRefresh({ intervalMs = 10_000 }: { intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);
  return null;
}
