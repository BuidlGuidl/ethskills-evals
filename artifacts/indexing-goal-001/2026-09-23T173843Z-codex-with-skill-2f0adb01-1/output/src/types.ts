export type CheckInEvent = {
  id: string;
  member: `0x${string}`;
  note: string;
  day: number;
  timestamp: number;
  blockNumber: number;
  txHash: `0x${string}`;
  logIndex: number;
};

export type FeedCursor = {
  blockNumber: number;
  logIndex: number;
};

export type FeedItem = CheckInEvent & {
  cursor: string;
};

export type MemberProfile = {
  address: `0x${string}`;
  totalCheckIns: number;
  currentStreak: number;
  firstCheckInDay: number | null;
  lastCheckInDay: number | null;
  streakAtLastCheckIn: number;
  lastCheckInAt: number | null;
};

export type LeaderboardEntry = {
  address: `0x${string}`;
  month: string;
  checkIns: number;
  latestCheckInAt: number;
};
