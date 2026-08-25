export type CheckIn = {
  id: string;
  member: { id: string };
  note: string;
  timestamp: string;
  transactionHash: string;
};

export type MemberProfile = {
  address: string;
  currentStreak: number;
  totalCheckIns: number;
  lastCheckInAt: Date;
};

export type LeaderboardEntry = { address: string; count: number };

type GraphResponse<T> = { data?: T; errors?: Array<{ message: string }> };

export class StreakClient {
  constructor(private readonly endpoint: string) {}

  private async query<T>(query: string, variables: Record<string, unknown>): Promise<T> {
    const response = await fetch(this.endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query, variables }),
    });
    const body = (await response.json()) as GraphResponse<T>;
    if (!response.ok || body.errors || !body.data) {
      throw new Error(body.errors?.map(error => error.message).join("; ") ?? `GraphQL HTTP ${response.status}`);
    }
    return body.data;
  }

  async getFeed(first = 50, skip = 0): Promise<CheckIn[]> {
    const data = await this.query<{ checkIns: CheckIn[] }>(
      `query Feed($first: Int!, $skip: Int!) {
        checkIns(first: $first, skip: $skip, orderBy: sequence, orderDirection: desc) {
          id member { id } note timestamp transactionHash
        }
      }`,
      { first, skip },
    );
    return data.checkIns;
  }

  async getMember(address: string, now = new Date()): Promise<MemberProfile | null> {
    const data = await this.query<{
      member: null | { id: string; totalCheckIns: string; indexedStreak: string; lastCheckInDay: string; lastCheckInAt: string };
    }>(`query Member($id: Bytes!) {
      member(id: $id) { id totalCheckIns indexedStreak lastCheckInDay lastCheckInAt }
    }`, { id: address.toLowerCase() });
    if (!data.member) return null;

    const today = Math.floor(now.getTime() / 86_400_000);
    const lastDay = Number(data.member.lastCheckInDay);
    return {
      address: data.member.id,
      currentStreak: today - lastDay <= 1 ? Number(data.member.indexedStreak) : 0,
      totalCheckIns: Number(data.member.totalCheckIns),
      lastCheckInAt: new Date(Number(data.member.lastCheckInAt) * 1000),
    };
  }

  async getMonthlyLeaderboard(now = new Date(), first = 100): Promise<LeaderboardEntry[]> {
    const month = now.toISOString().slice(0, 7);
    const data = await this.query<{ memberMonths: Array<{ count: string; member: { id: string } }> }>(
      `query Leaderboard($month: String!, $first: Int!) {
        memberMonths(where: { month: $month }, first: $first, orderBy: count, orderDirection: desc) {
          count member { id }
        }
      }`,
      { month, first },
    );
    return data.memberMonths.map(row => ({ address: row.member.id, count: Number(row.count) }));
  }
}
