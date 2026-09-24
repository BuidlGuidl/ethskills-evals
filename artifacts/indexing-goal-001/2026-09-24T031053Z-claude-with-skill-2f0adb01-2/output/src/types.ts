/** A row in the global feed. */
export interface CheckInRow {
  id: string;
  member: `0x${string}`;
  /** UTC day index the check-in counted for. */
  day: number;
  /** "YYYY-MM-DD". */
  date: string;
  /** Empty string when the member left no note. */
  note: string;
  /** Streak the member reached with this check-in. */
  streakAfter: number;
  timestamp: number;
  blockNumber: number;
  txHash: `0x${string}`;
  logIndex: number;
  /** Chain order key; pass back as the feed cursor. */
  seq: string;
}

/** Everything the profile screen shows. */
export interface MemberProfile {
  address: `0x${string}`;
  /** Streak to display today (0 once a day has been missed). */
  currentStreak: number;
  /** Stored streak as of `lastCheckInDay`, before the liveness rule. */
  streakAsOfLastCheckIn: number;
  longestStreak: number;
  totalCheckIns: number;
  firstCheckInDay: number;
  firstCheckInAt: number;
  lastCheckInDay: number;
  lastCheckInAt: number;
  /** True if they have not checked in yet today. */
  canCheckInToday: boolean;
  /** Most recent check-ins, newest first. */
  recentCheckIns: CheckInRow[];
  /** This month's check-in count. */
  checkInsThisMonth: number;
  /** Set when the member has never checked in. */
  isNewMember: boolean;
}

/** A row on the monthly leaderboard. */
export interface LeaderboardRow {
  rank: number;
  member: `0x${string}`;
  checkIns: number;
  /** Streak to display today for this member. */
  currentStreak: number;
  totalCheckIns: number;
  lastCheckInAt: number;
}

export interface Leaderboard {
  /** "YYYY-MM". */
  month: string;
  /** Days in the month elapsed so far (the max achievable count). */
  daysElapsed: number;
  rows: LeaderboardRow[];
}

export interface CommunityStats {
  totalCheckIns: number;
  totalMembers: number;
  firstCheckInAt: number;
  lastCheckInAt: number;
}
