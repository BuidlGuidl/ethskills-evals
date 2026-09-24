import type { Address, Hex } from "viem";

export type CheckInRecord = {
  id: string;
  member: Address;
  day: number;
  timestamp: number;
  note: string;
  totalCheckInsAtEvent: number;
  streakAtEvent: number;
  blockNumber: string;
  blockHash: Hex;
  transactionHash: Hex;
  logIndex: number;
};

export type PersistedReadModel = {
  version: 1;
  cursorBlock: string | null;
  checkIns: CheckInRecord[];
};

export type MemberProfile = {
  member: Address;
  currentStreak: number;
  totalCheckIns: number;
  lastCheckInDay: number | null;
  lastCheckInAt: number | null;
};

export type LeaderboardEntry = {
  member: Address;
  checkIns: number;
  currentStreak: number;
  totalCheckIns: number;
  lastCheckInAt: number;
  rank: number;
};
