import type { Address, Hex } from "viem";

export type CheckInRecord = {
  id: string;
  member: Address;
  day: number;
  timestamp: number;
  note: string;
  blockNumber: number;
  transactionHash: Hex;
  logIndex: number;
};

export type MemberProfile = {
  member: Address;
  currentStreak: number;
  totalCheckIns: number;
  lastCheckInDay: number | null;
  lastCheckInAt: string | null;
};

export type LeaderboardEntry = {
  member: Address;
  checkIns: number;
  currentStreak: number;
  totalCheckIns: number;
  rank: number;
};

export type PersistedState = {
  contractAddress: Address;
  indexedToBlock: number;
  checkIns: CheckInRecord[];
};
