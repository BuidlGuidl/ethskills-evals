export type Address = `0x${string}`;

export interface CheckInItem {
  /** Opaque id, also the feed cursor. */
  id: string;
  member: Address;
  note: string;
  /** Streak as of this check-in. */
  streak: number;
  /** The member's all-time total as of this check-in. */
  memberTotal: number;
  day: number;
  month: string;
  timestamp: number;
  checkedInAt: string;
  blockNumber: string;
  txHash: Address;
}

export interface FeedPage {
  items: CheckInItem[];
  /** Pass back as `cursor` for the next page; null at the contract's first day. */
  nextCursor: string | null;
}

export interface Profile {
  member: Address;
  currentStreak: number;
  longestStreak: number;
  total: number;
  checkedInToday: boolean;
  firstCheckInAt: string | null;
  lastCheckInAt: string | null;
  lastNote?: string;
  thisMonth: number;
  recentCheckIns: CheckInItem[];
}

export interface LeaderboardRow {
  rank: number;
  member: Address;
  checkIns: number;
  longestStreakInMonth: number;
  currentStreak: number;
  allTimeTotal: number;
  lastCheckInAt: string;
}

export interface Leaderboard {
  month: string;
  items: LeaderboardRow[];
}

export interface CommunityStats {
  totalCheckIns: number;
  totalMembers: number;
  lastCheckInAt: string | null;
  currentMonth: string;
}
