export type FeedCursor = {
  checkedAt: string;
  blockNumber: string;
  logIndex: number;
};

export function encodeFeedCursor(cursor: FeedCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodeFeedCursor(value: string): FeedCursor {
  const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as FeedCursor;
  if (
    typeof parsed.checkedAt !== "string" ||
    typeof parsed.blockNumber !== "string" ||
    typeof parsed.logIndex !== "number"
  ) {
    throw new Error("Invalid feed cursor");
  }
  return parsed;
}
