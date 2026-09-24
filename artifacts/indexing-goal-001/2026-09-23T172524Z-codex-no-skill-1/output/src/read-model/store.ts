import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { getAddress, isAddress, type Address } from "viem";
import type { CheckInRecord, LeaderboardEntry, MemberProfile, PersistedReadModel } from "./types.js";
import { currentUtcDay } from "./time.js";

const EMPTY_MODEL: PersistedReadModel = {
  version: 1,
  cursorBlock: null,
  checkIns: []
};

export class ReadModelStore {
  private model: PersistedReadModel;
  private readonly ids = new Set<string>();

  constructor(private readonly filePath: string) {
    this.model = this.load();
    for (const checkIn of this.model.checkIns) {
      this.ids.add(checkIn.id);
    }
  }

  get cursorBlock(): bigint | null {
    return this.model.cursorBlock === null ? null : BigInt(this.model.cursorBlock);
  }

  upsertMany(records: CheckInRecord[]): number {
    let inserted = 0;

    for (const record of records) {
      if (this.ids.has(record.id)) {
        continue;
      }

      this.model.checkIns.push(record);
      this.ids.add(record.id);
      inserted += 1;
    }

    if (inserted > 0) {
      this.model.checkIns.sort(compareNewestFirst);
    }

    return inserted;
  }

  setCursor(blockNumber: bigint): void {
    this.model.cursorBlock = blockNumber.toString();
  }

  flush(): void {
    mkdirSync(dirname(this.filePath), { recursive: true });
    const tmpPath = `${this.filePath}.tmp`;
    writeFileSync(tmpPath, `${JSON.stringify(this.model, null, 2)}\n`);
    renameSync(tmpPath, this.filePath);
  }

  feed(limit: number): CheckInRecord[] {
    return this.model.checkIns.slice(0, clampLimit(limit, 100));
  }

  memberProfile(memberInput: string, now = new Date()): MemberProfile {
    const member = normalizeAddress(memberInput);
    const memberRecords = this.recordsForMember(member);
    const daySet = new Set(memberRecords.map((record) => record.day));
    const last = memberRecords[0] ?? null;

    return {
      member,
      currentStreak: calculateCurrentStreak(daySet, currentUtcDay(now)),
      totalCheckIns: memberRecords.length,
      lastCheckInDay: last?.day ?? null,
      lastCheckInAt: last?.timestamp ?? null
    };
  }

  monthlyLeaderboard(
    startDay: number,
    endDay: number,
    limit: number,
    now = new Date()
  ): LeaderboardEntry[] {
    const monthCounts = new Map<Address, { checkIns: number; lastCheckInAt: number }>();

    for (const record of this.model.checkIns) {
      if (record.day < startDay || record.day >= endDay) {
        continue;
      }

      const entry = monthCounts.get(record.member) ?? { checkIns: 0, lastCheckInAt: 0 };
      entry.checkIns += 1;
      entry.lastCheckInAt = Math.max(entry.lastCheckInAt, record.timestamp);
      monthCounts.set(record.member, entry);
    }

    const rows = [...monthCounts.entries()].map(([member, monthly]) => {
      const profile = this.memberProfile(member, now);
      return {
        member,
        checkIns: monthly.checkIns,
        currentStreak: profile.currentStreak,
        totalCheckIns: profile.totalCheckIns,
        lastCheckInAt: monthly.lastCheckInAt,
        rank: 0
      };
    });

    rows.sort((a, b) => {
      if (b.checkIns !== a.checkIns) {
        return b.checkIns - a.checkIns;
      }

      if (b.lastCheckInAt !== a.lastCheckInAt) {
        return b.lastCheckInAt - a.lastCheckInAt;
      }

      return a.member.localeCompare(b.member);
    });

    return rows.slice(0, clampLimit(limit, 100)).map((entry, index) => ({
      ...entry,
      rank: index + 1
    }));
  }

  private recordsForMember(member: Address): CheckInRecord[] {
    return this.model.checkIns.filter((record) => record.member === member);
  }

  private load(): PersistedReadModel {
    try {
      const parsed = JSON.parse(readFileSync(this.filePath, "utf8")) as PersistedReadModel;
      if (parsed.version !== 1 || !Array.isArray(parsed.checkIns)) {
        throw new Error("unsupported read model format");
      }

      parsed.checkIns = parsed.checkIns.map((record) => ({
        ...record,
        member: normalizeAddress(record.member)
      }));
      parsed.checkIns.sort(compareNewestFirst);

      return parsed;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return { ...EMPTY_MODEL, checkIns: [] };
      }

      throw error;
    }
  }
}

export function calculateCurrentStreak(days: Set<number>, todayDay: number): number {
  let cursor = days.has(todayDay) ? todayDay : todayDay - 1;
  let streak = 0;

  while (days.has(cursor)) {
    streak += 1;
    cursor -= 1;
  }

  return streak;
}

function compareNewestFirst(a: CheckInRecord, b: CheckInRecord): number {
  const blockDiff = BigInt(b.blockNumber) - BigInt(a.blockNumber);
  if (blockDiff !== 0n) {
    return blockDiff > 0n ? 1 : -1;
  }

  return b.logIndex - a.logIndex;
}

function clampLimit(limit: number, max: number): number {
  if (!Number.isFinite(limit)) {
    return max;
  }

  return Math.max(1, Math.min(max, Math.floor(limit)));
}

function normalizeAddress(address: string): Address {
  if (!isAddress(address)) {
    throw new Error("invalid address");
  }

  return getAddress(address);
}
