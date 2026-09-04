import { parseAbi } from "viem";

export const streakAbi = parseAbi([
  "event CheckIn(address indexed member, uint64 indexed day, uint64 timestamp, string note)",
  "function checkIn(string note)",
  "function lastCheckInDay(address member) view returns (uint64)",
]);
