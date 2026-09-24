import { parseAbi } from "viem";

export const streakAbi = parseAbi([
  "event CheckedIn(address indexed member, uint256 indexed day, uint256 timestamp, string note)",
  "function checkIn(string note)",
  "function lastCheckInDay(address member) view returns (uint256)",
  "function totalCheckIns(address member) view returns (uint256)",
  "function MAX_NOTE_BYTES() view returns (uint256)",
]);
