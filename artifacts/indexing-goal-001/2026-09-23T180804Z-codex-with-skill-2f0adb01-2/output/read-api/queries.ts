import { GraphQLClient, gql } from "graphql-request";

export type FeedItem = {
  id: string;
  checkInId: string;
  memberAddress: string;
  day: string;
  note: string;
  streakAfter: string;
  memberTotalAfter: string;
  timestamp: string;
  blockNumber: string;
  transactionHash: string;
};

export type MemberProfile = {
  address: string;
  currentStreak: string;
  totalCheckIns: string;
  lastCheckInDay: string | null;
  lastCheckInAt: string | null;
};

export type LeaderboardEntry = {
  rank: number;
  memberAddress: string;
  checkIns: string;
  lastCheckInAt: string;
  currentStreak: string;
  totalCheckIns: string;
};

export type Leaderboard = {
  month: string;
  monthTotalCheckIns: string;
  entries: LeaderboardEntry[];
};

const FEED_QUERY = gql`
  query Feed($limit: Int!, $skip: Int!) {
    checkIns(first: $limit, skip: $skip, orderBy: checkInId, orderDirection: desc) {
      id
      checkInId
      memberAddress
      day
      note
      streakAfter
      memberTotalAfter
      timestamp
      blockNumber
      transactionHash
    }
  }
`;

const PROFILE_QUERY = gql`
  query Profile($id: ID!) {
    member(id: $id) {
      id
      address
      currentStreak
      totalCheckIns
      lastCheckInDay
      lastCheckInAt
    }
  }
`;

const LEADERBOARD_QUERY = gql`
  query Leaderboard($month: ID!, $limit: Int!, $skip: Int!) {
    month(id: $month) {
      id
      totalCheckIns
    }
    monthMembers(first: $limit, skip: $skip, where: { month: $month }, orderBy: checkIns, orderDirection: desc) {
      id
      memberAddress
      checkIns
      lastCheckInAt
      member {
        currentStreak
        totalCheckIns
        lastCheckInDay
      }
    }
  }
`;

type FeedResponse = {
  checkIns: FeedItem[];
};

type ProfileResponse = {
  member: {
    address: string;
    currentStreak: string;
    totalCheckIns: string;
    lastCheckInDay: string;
    lastCheckInAt: string;
  } | null;
};

type LeaderboardResponse = {
  month: {
    totalCheckIns: string;
  } | null;
  monthMembers: Array<{
    memberAddress: string;
    checkIns: string;
    lastCheckInAt: string;
    member: {
      currentStreak: string;
      totalCheckIns: string;
      lastCheckInDay: string;
    };
  }>;
};

export function createSubgraphClient(url = requiredEnv("SUBGRAPH_URL")): GraphQLClient {
  return new GraphQLClient(url);
}

export async function getFeed(
  client: GraphQLClient,
  options: { limit?: number; skip?: number } = {},
): Promise<FeedItem[]> {
  const limit = clampLimit(options.limit, 50);
  const skip = Math.max(options.skip ?? 0, 0);
  const data = await client.request<FeedResponse>(FEED_QUERY, { limit, skip });
  return data.checkIns;
}

export async function getMemberProfile(
  client: GraphQLClient,
  address: string,
): Promise<MemberProfile> {
  const normalized = normalizeAddress(address);
  const data = await client.request<ProfileResponse>(PROFILE_QUERY, { id: normalized });

  if (data.member == null) {
    return {
      address: normalized,
      currentStreak: "0",
      totalCheckIns: "0",
      lastCheckInDay: null,
      lastCheckInAt: null,
    };
  }

  return {
    address: data.member.address,
    currentStreak: effectiveCurrentStreak(data.member.currentStreak, data.member.lastCheckInDay),
    totalCheckIns: data.member.totalCheckIns,
    lastCheckInDay: data.member.lastCheckInDay,
    lastCheckInAt: data.member.lastCheckInAt,
  };
}

export async function getMonthlyLeaderboard(
  client: GraphQLClient,
  options: { month?: string; limit?: number; skip?: number } = {},
): Promise<Leaderboard> {
  const month = normalizeMonth(options.month ?? currentUtcMonth());
  const limit = clampLimit(options.limit, 50);
  const skip = Math.max(options.skip ?? 0, 0);
  const data = await client.request<LeaderboardResponse>(LEADERBOARD_QUERY, { month, limit, skip });

  return {
    month,
    monthTotalCheckIns: data.month?.totalCheckIns ?? "0",
    entries: data.monthMembers.map((entry, index) => ({
      rank: skip + index + 1,
      memberAddress: entry.memberAddress,
      checkIns: entry.checkIns,
      lastCheckInAt: entry.lastCheckInAt,
      currentStreak: effectiveCurrentStreak(entry.member.currentStreak, entry.member.lastCheckInDay),
      totalCheckIns: entry.member.totalCheckIns,
    })),
  };
}

export function normalizeAddress(address: string): string {
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
    throw new Error("Expected an EVM address");
  }

  return address.toLowerCase();
}

export function normalizeMonth(month: string): string {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    throw new Error("Expected month in YYYY-MM format");
  }

  return month;
}

export function currentUtcMonth(date = new Date()): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export function clampLimit(value: number | undefined, fallback: number): number {
  if (value == null || Number.isNaN(value)) {
    return fallback;
  }

  return Math.min(Math.max(Math.trunc(value), 1), 100);
}

export function effectiveCurrentStreak(
  streakAfterLastCheckIn: string,
  lastCheckInDay: string | null,
  date = new Date(),
): string {
  if (lastCheckInDay == null) {
    return "0";
  }

  const today = Math.floor(date.getTime() / 86_400_000);
  const lastDay = Number(lastCheckInDay);
  return lastDay >= today - 1 ? streakAfterLastCheckIn : "0";
}

function requiredEnv(name: string): string {
  const value = process.env[name];

  if (value == null || value.length === 0) {
    throw new Error(`${name} is required`);
  }

  return value;
}
