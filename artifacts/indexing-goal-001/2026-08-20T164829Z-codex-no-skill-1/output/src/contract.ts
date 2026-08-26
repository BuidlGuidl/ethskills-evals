import { parseAbiItem } from "viem";

export const checkedInEvent = parseAbiItem(
  "event CheckedIn(address indexed member, uint64 indexed day, string note)",
);

export const streakAbi = [checkedInEvent] as const;
