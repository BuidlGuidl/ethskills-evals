import { parseAbiItem } from "viem";

export const checkedInEvent = parseAbiItem(
  "event CheckedIn(address indexed account, uint64 indexed day, string note)",
);

