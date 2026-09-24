import type { Pool, PoolClient } from "pg";
import { getAddress, isAddress } from "viem";
import { activeCurrentStreak, currentUtcDay, isValidMonthKey } from "./time.js";

export type CheckInRecord = {
  member: string;
  dayUtc: number;
  checkedInAt: string;
  timestampUnix: string;
  note: string;
  txHash: string;
  blockNumber: string;
  logIndex: number;
};

export type IndexedCheckIn = CheckInRecord & {
  id: string;
  monthKey: string;
};

export function normalizeMember(address: string): string {
  if (!isAddress(address)) {
    throw new Error("Invalid member address");
  }
  return getAddress(address).toLowerCase();
}

export async function recordCheckIn(client: PoolClient, checkIn: IndexedCheckIn): Promise<boolean> {
  const inserted = await client.query(
    `
      insert into check_ins (
        id, member, day_utc, checked_in_at, timestamp_unix, note,
        tx_hash, block_number, log_index, month_key
      )
      values ($1, $2, $3, to_timestamp($4), $4, $5, $6, $7, $8, $9)
      on conflict do nothing
      returning id
    `,
    [
      checkIn.id,
      checkIn.member,
      checkIn.dayUtc,
      checkIn.timestampUnix,
      checkIn.note,
      checkIn.txHash,
      checkIn.blockNumber,
      checkIn.logIndex,
      checkIn.monthKey,
    ],
  );

  if (!inserted.rowCount) return false;

  await client.query(
    `
      insert into member_stats (
        member, total_check_ins, current_streak, last_check_in_day, last_check_in_at, updated_at
      )
      values ($1, 1, 1, $2, to_timestamp($3), now())
      on conflict (member) do update set
        total_check_ins = member_stats.total_check_ins + 1,
        current_streak = case
          when member_stats.last_check_in_day = excluded.last_check_in_day - 1 then member_stats.current_streak + 1
          else 1
        end,
        last_check_in_day = excluded.last_check_in_day,
        last_check_in_at = excluded.last_check_in_at,
        updated_at = now()
      where member_stats.last_check_in_day is null
        or member_stats.last_check_in_day < excluded.last_check_in_day
    `,
    [checkIn.member, checkIn.dayUtc, checkIn.timestampUnix],
  );

  await client.query(
    `
      insert into monthly_counts (month_key, member, check_ins, updated_at)
      values ($1, $2, 1, now())
      on conflict (month_key, member) do update set
        check_ins = monthly_counts.check_ins + 1,
        updated_at = now()
    `,
    [checkIn.monthKey, checkIn.member],
  );

  await client.query("select pg_notify('check_ins', $1)", [JSON.stringify(toPublicCheckIn(checkIn))]);
  return true;
}

export async function getFeed(pool: Pool, options: { limit: number; cursor?: string }) {
  const limit = Math.min(Math.max(options.limit, 1), 100);
  const cursor = parseCursor(options.cursor);

  const params: Array<string | number> = [limit];
  let where = "";
  if (cursor) {
    params.push(cursor.blockNumber, cursor.logIndex);
    where = "where (block_number, log_index) < ($2, $3)";
  }

  const result = await pool.query(
    `
      select member, day_utc, checked_in_at, timestamp_unix, note, tx_hash, block_number, log_index
      from check_ins
      ${where}
      order by block_number desc, log_index desc
      limit $1
    `,
    params,
  );

  const items = result.rows.map(rowToCheckIn);
  const last = items.at(-1);
  return {
    items,
    nextCursor: last ? `${last.blockNumber}:${last.logIndex}` : null,
  };
}

export async function getMemberProfile(pool: Pool, address: string, today = currentUtcDay()) {
  const member = normalizeMember(address);
  const result = await pool.query<{
    total_check_ins: number;
    current_streak: number;
    last_check_in_day: number | null;
    last_check_in_at: Date | null;
  }>(
    `
      select total_check_ins, current_streak, last_check_in_day, last_check_in_at
      from member_stats
      where member = $1
    `,
    [member],
  );

  if (!result.rowCount) {
    return {
      member,
      currentStreak: 0,
      totalCheckIns: 0,
      lastCheckInDay: null,
      lastCheckInAt: null,
    };
  }

  const row = result.rows[0];
  return {
    member,
    currentStreak: activeCurrentStreak(row.current_streak, row.last_check_in_day, today),
    totalCheckIns: row.total_check_ins,
    lastCheckInDay: row.last_check_in_day,
    lastCheckInAt: row.last_check_in_at?.toISOString() ?? null,
  };
}

export async function getMonthlyLeaderboard(pool: Pool, options: { monthKey: string; limit: number }) {
  if (!isValidMonthKey(options.monthKey)) {
    throw new Error("Month must use YYYY-MM");
  }

  const limit = Math.min(Math.max(options.limit, 1), 100);
  const result = await pool.query<{ member: string; check_ins: number }>(
    `
      select member, check_ins
      from monthly_counts
      where month_key = $1
      order by check_ins desc, member asc
      limit $2
    `,
    [options.monthKey, limit],
  );

  return {
    month: options.monthKey,
    items: result.rows.map((row, index) => ({
      rank: index + 1,
      member: row.member,
      checkIns: row.check_ins,
    })),
  };
}

function parseCursor(cursor?: string): { blockNumber: string; logIndex: number } | null {
  if (!cursor) return null;
  const [blockNumber, logIndex] = cursor.split(":");
  if (!blockNumber || !logIndex || !/^\d+$/.test(blockNumber) || !/^\d+$/.test(logIndex)) {
    throw new Error("Cursor must use blockNumber:logIndex");
  }
  return { blockNumber, logIndex: Number(logIndex) };
}

function rowToCheckIn(row: {
  member: string;
  day_utc: number;
  checked_in_at: Date;
  timestamp_unix: string;
  note: string;
  tx_hash: string;
  block_number: string;
  log_index: number;
}): CheckInRecord {
  return {
    member: row.member,
    dayUtc: row.day_utc,
    checkedInAt: row.checked_in_at.toISOString(),
    timestampUnix: row.timestamp_unix,
    note: row.note,
    txHash: row.tx_hash,
    blockNumber: row.block_number,
    logIndex: row.log_index,
  };
}

function toPublicCheckIn(checkIn: IndexedCheckIn): CheckInRecord {
  return {
    member: checkIn.member,
    dayUtc: checkIn.dayUtc,
    checkedInAt: new Date(Number(checkIn.timestampUnix) * 1000).toISOString(),
    timestampUnix: checkIn.timestampUnix,
    note: checkIn.note,
    txHash: checkIn.txHash,
    blockNumber: checkIn.blockNumber,
    logIndex: checkIn.logIndex,
  };
}

