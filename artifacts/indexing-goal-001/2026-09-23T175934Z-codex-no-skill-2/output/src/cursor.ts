import type { CheckInRecord } from "./types.js";

type FeedCursor = {
  blockNumber: number;
  logIndex: number;
};

export function encodeCursor(record: CheckInRecord): string {
  return Buffer.from(
    JSON.stringify({
      blockNumber: record.blockNumber,
      logIndex: record.logIndex,
    } satisfies FeedCursor),
  ).toString("base64url");
}

export function decodeCursor(cursor: string): FeedCursor {
  const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
  if (
    typeof parsed.blockNumber !== "number" ||
    typeof parsed.logIndex !== "number"
  ) {
    throw new Error("invalid cursor");
  }
  return parsed;
}

export function isBeforeCursor(record: CheckInRecord, cursor: FeedCursor): boolean {
  return (
    record.blockNumber < cursor.blockNumber ||
    (record.blockNumber === cursor.blockNumber && record.logIndex < cursor.logIndex)
  );
}
