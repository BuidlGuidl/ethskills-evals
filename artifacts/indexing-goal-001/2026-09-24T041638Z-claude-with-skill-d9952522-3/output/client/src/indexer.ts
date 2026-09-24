import type { Address, CommunityStats, FeedPage, Leaderboard, Profile } from "./types";

/**
 * Read client for the Streak indexer — the three screens' historical data.
 *
 * Everything here is served from the indexer's Postgres, which was backfilled
 * from the contract's deploy block. No screen ever scans logs at request time.
 */
export class StreakIndexer {
  constructor(private readonly baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  private async get<T>(path: string, params: Record<string, string | number | undefined> = {}): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
    const res = await fetch(url, { headers: { accept: "application/json" } });
    if (!res.ok) {
      throw new Error(`Streak indexer ${path} failed: ${res.status} ${await res.text()}`);
    }
    return (await res.json()) as T;
  }

  /** Screen 1: global feed, newest first. Page with `nextCursor`. */
  feed(options: { limit?: number; cursor?: string | null; member?: Address } = {}): Promise<FeedPage> {
    return this.get<FeedPage>("/feed", {
      limit: options.limit ?? 50,
      cursor: options.cursor ?? undefined,
      member: options.member,
    });
  }

  /** Screen 2: profile — streak, all-time total and that member's own history. */
  profile(member: Address, options: { limit?: number } = {}): Promise<Profile> {
    return this.get<Profile>(`/members/${member}`, { limit: options.limit });
  }

  /** Screen 3: leaderboard for a UTC calendar month; defaults to this month. */
  leaderboard(options: { month?: string; limit?: number } = {}): Promise<Leaderboard> {
    return this.get<Leaderboard>("/leaderboard", { month: options.month, limit: options.limit ?? 25 });
  }

  /** Community header numbers. */
  stats(): Promise<CommunityStats> {
    return this.get<CommunityStats>("/stats");
  }
}
