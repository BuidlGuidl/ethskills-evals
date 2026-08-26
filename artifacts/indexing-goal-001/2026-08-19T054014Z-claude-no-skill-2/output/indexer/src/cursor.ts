/**
 * Feed pagination cursors.
 *
 * A cursor is the (blockNumber, logIndex) of the last row on the page. That
 * pair is a total order over logs on a chain, so paging can neither skip nor
 * repeat a check-in — which an offset or a timestamp cursor both can, since
 * several check-ins routinely land in the same block.
 */
export type Cursor = { blockNumber: bigint; logIndex: number };

export function encodeCursor(blockNumber: bigint, logIndex: number): string {
  return `${blockNumber}:${logIndex}`;
}

export function decodeCursor(raw: string): Cursor | null {
  const parts = raw.split(":");
  if (parts.length !== 2) return null;
  const [block, log] = parts as [string, string];
  if (!/^\d+$/.test(block) || !/^\d+$/.test(log)) return null;
  return { blockNumber: BigInt(block), logIndex: Number.parseInt(log, 10) };
}
