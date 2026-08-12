import { FEED_QUERY, LEADERBOARD_QUERY, MEMBER_QUERY } from "./queries.js";

type GraphResponse<T> = { data?: T; errors?: { message: string }[] };
type RawMember = {
  id: string;
  totalCheckIns: string;
  streak: string;
  lastCheckInDay: string;
  lastCheckInAt: string;
};

export type FeedItem = {
  id: string;
  member: string;
  day: number;
  timestamp: Date;
  note: string;
  transactionHash: string;
};

export type MemberProfile = {
  address: string;
  totalCheckIns: number;
  currentStreak: number;
  lastCheckInAt: Date;
};

export type LeaderboardEntry = {
  rank: number;
  member: string;
  checkIns: number;
  lastCheckInAt: Date;
};

export class StreakClient {
  constructor(private readonly endpoint: string) {}

  private async query<T>(query: string, variables: Record<string, unknown>): Promise<T> {
    const response = await fetch(this.endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query, variables }),
    });
    if (!response.ok) throw new Error(`Subgraph request failed: ${response.status}`);
    const body = (await response.json()) as GraphResponse<T>;
    if (body.errors?.length) throw new Error(body.errors.map(error => error.message).join("; "));
    if (!body.data) throw new Error("Subgraph returned no data");
    return body.data;
  }

  async feed(first = 50, skip = 0): Promise<FeedItem[]> {
    const data = await this.query<{ checkIns: (Omit<FeedItem, "member" | "day" | "timestamp"> & {
      member: { id: string }; day: string; timestamp: string;
    })[] }>(FEED_QUERY, { first, skip });
    return data.checkIns.map(item => ({
      ...item,
      member: item.member.id,
      day: Number(item.day),
      timestamp: new Date(Number(item.timestamp) * 1000),
    }));
  }

  watchFeed(onItems: (items: FeedItem[]) => void, intervalMs = 5_000): () => void {
    let stopped = false;
    const poll = async () => {
      try { if (!stopped) onItems(await this.feed()); } finally {
        if (!stopped) setTimeout(poll, intervalMs);
      }
    };
    void poll();
    return () => { stopped = true; };
  }

  async member(address: string, now = new Date()): Promise<MemberProfile | null> {
    const data = await this.query<{ member: RawMember | null }>(MEMBER_QUERY, { id: address.toLowerCase() });
    if (!data.member) return null;
    const today = Math.floor(now.getTime() / 86_400_000);
    const lastDay = Number(data.member.lastCheckInDay);
    return {
      address: data.member.id,
      totalCheckIns: Number(data.member.totalCheckIns),
      currentStreak: lastDay >= today - 1 ? Number(data.member.streak) : 0,
      lastCheckInAt: new Date(Number(data.member.lastCheckInAt) * 1000),
    };
  }

  async leaderboard(now = new Date(), first = 100): Promise<LeaderboardEntry[]> {
    const month = now.toISOString().slice(0, 7);
    const data = await this.query<{ monthlyMembers: {
      member: string; checkIns: string; lastCheckInAt: string;
    }[] }>(LEADERBOARD_QUERY, { month, first });
    return data.monthlyMembers.map((entry, index) => ({
      rank: index + 1,
      member: entry.member,
      checkIns: Number(entry.checkIns),
      lastCheckInAt: new Date(Number(entry.lastCheckInAt) * 1000),
    }));
  }
}
