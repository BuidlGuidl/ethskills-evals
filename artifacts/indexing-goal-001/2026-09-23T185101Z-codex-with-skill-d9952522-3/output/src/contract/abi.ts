import { parseAbi, parseAbiItem } from "viem";

export const streakAbi = parseAbi([
  "function checkIn(string note)",
  "function currentStreak(address member) view returns (uint256)",
  "function lastCheckInDay(address member) view returns (uint256)",
  "function totalCheckIns(address member) view returns (uint256)",
  "event CheckIn(address indexed member, uint256 indexed dayNumber, uint256 checkedAt, string note, uint256 currentStreak, uint256 totalCheckIns)",
]);

export const checkInEvent = parseAbiItem(
  "event CheckIn(address indexed member, uint256 indexed dayNumber, uint256 checkedAt, string note, uint256 currentStreak, uint256 totalCheckIns)",
);
