import { GraphQLClient, gql } from "graphql-request";

type CheckInRow = {
  id: string;
  member: { id: string };
  note: string;
  timestamp: string;
  transactionHash: string;
};

type MemberRow = {
  id: string;
  totalCheckIns: string;
  currentStreak: string;
  lastCheckInDay: string;
  lastCheckInAt: string;
};

type MonthlyRow = {
  member: { id: string };
  checkIns: string;
  lastCheckInAt: string;
};

const endpoint = process.env.SUBGRAPH_URL;
if (!endpoint) throw new Error("SUBGRAPH_URL is required");
const client = new GraphQLClient(endpoint);

const FEED = gql`
  query Feed($first: Int!, $skip: Int!) {
    checkIns(first: $first, skip: $skip, orderBy: timestamp, orderDirection: desc) {
      id member { id } note timestamp transactionHash
    }
  }
`;

const PROFILE = gql`
  query Profile($id: Bytes!) {
    member(id: $id) {
      id totalCheckIns currentStreak lastCheckInDay lastCheckInAt
    }
  }
`;

const LEADERBOARD = gql`
  query Leaderboard($month: Int!, $first: Int!) {
    monthlyMembers(
      where: { month: $month }
      first: $first
      orderBy: checkIns
      orderDirection: desc
    ) {
      member { id } checkIns lastCheckInAt
    }
  }
`;

export async function getFeed(first: number, skip: number) {
  const data = await client.request<{ checkIns: CheckInRow[] }>(FEED, { first, skip });
  return data.checkIns.map(row => ({
    id: row.id,
    member: row.member.id,
    note: row.note,
    timestamp: Number(row.timestamp),
    transactionHash: row.transactionHash,
  }));
}

export async function getProfile(address: string, nowSeconds: number) {
  const data = await client.request<{ member: MemberRow | null }>(PROFILE, {
    id: address.toLowerCase(),
  });
  if (!data.member) return null;

  const today = Math.floor(nowSeconds / 86_400);
  const lastDay = Number(data.member.lastCheckInDay);
  return {
    address: data.member.id,
    currentStreak: lastDay >= today - 1 ? Number(data.member.currentStreak) : 0,
    totalCheckIns: Number(data.member.totalCheckIns),
    lastCheckInAt: Number(data.member.lastCheckInAt),
  };
}

export async function getLeaderboard(month: number, first: number) {
  const data = await client.request<{ monthlyMembers: MonthlyRow[] }>(LEADERBOARD, {
    month,
    first,
  });
  return data.monthlyMembers.map((row, index) => ({
    rank: index + 1,
    member: row.member.id,
    checkIns: Number(row.checkIns),
    lastCheckInAt: Number(row.lastCheckInAt),
  }));
}

export function monthIndex(date: Date) {
  return date.getUTCFullYear() * 12 + date.getUTCMonth();
}
