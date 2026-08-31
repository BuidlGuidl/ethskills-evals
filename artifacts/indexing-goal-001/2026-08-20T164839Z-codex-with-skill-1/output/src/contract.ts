import { parseAbiItem } from "viem";

export const checkedInEvent = parseAbiItem(
  "event CheckedIn(address indexed member, uint64 indexed day, uint64 checkedInAt, string note)",
);
