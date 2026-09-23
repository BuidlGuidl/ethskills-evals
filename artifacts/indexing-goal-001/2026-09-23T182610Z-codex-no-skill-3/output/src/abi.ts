import { parseAbi, parseAbiItem } from "viem";

export const streakAbi = parseAbi([
  "event CheckIn(address indexed member, uint256 indexed day, string note)",
  "function checkIn(string note)",
  "function lastCheckInDay(address member) view returns (uint256)",
  "function totalCheckIns(address member) view returns (uint256)",
]);

export const checkInEvent = parseAbiItem(
  "event CheckIn(address indexed member, uint256 indexed day, string note)",
);
