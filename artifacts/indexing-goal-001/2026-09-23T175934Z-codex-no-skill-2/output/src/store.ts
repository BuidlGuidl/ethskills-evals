import { EventEmitter } from "node:events";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { getAddress, isAddress } from "viem";
import { decodeCursor, encodeCursor, isBeforeCursor } from "./cursor.js";
import { currentUtcMonth, dayFromDate, isoFromUnix, parseMonth } from "./dates.js";
import type {
  CheckInRecord,
  LeaderboardEntry,
  MemberProfile,
  PersistedState,
} from "./types.js";

type FeedPage = {
  items: Array<CheckInRecord & { checkedInAt: string }>;
  nextCursor: string | null;
};

export class StreakStore {
  private state: PersistedState;
  private readonly byId = new Map<string, CheckInRecord>();
  private readonly daysByMember = new Map<string, Set<number>>();
  private readonly emitter = new EventEmitter();

  private constructor(
    private readonly dbPath: string,
    contractAddress: `0x${string}`,
    indexedToBlock: number,
    checkIns: CheckInRecord[],
  ) {
    this.state = {
      contractAddress,
      indexedToBlock,
      checkIns: [],
    };
    for (const checkIn of checkIns) {
      this.apply(checkIn, false);
    }
  }

  static async open(
    dbPath: string,
    contractAddress: `0x${string}`,
    startBlock: number,
  ): Promise<StreakStore> {
    try {
      const raw = await readFile(dbPath, "utf8");
      const parsed = JSON.parse(raw) as PersistedState;
      const storedAddress = getAddress(parsed.contractAddress);
      if (storedAddress !== contractAddress) {
        throw new Error(
          `index belongs to ${storedAddress}, not ${contractAddress}; remove ${dbPath} or choose another STREAK_DB_PATH`,
        );
      }
      return new StreakStore(
        dbPath,
        contractAddress,
        Math.max(parsed.indexedToBlock, startBlock - 1),
        parsed.checkIns,
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
      return new StreakStore(dbPath, contractAddress, startBlock - 1, []);
    }
  }

  get indexedToBlock(): number {
    return this.state.indexedToBlock;
  }

  setIndexedToBlock(blockNumber: number): void {
    this.state.indexedToBlock = Math.max(this.state.indexedToBlock, blockNumber);
  }

  async flush(): Promise<void> {
    await mkdir(dirname(this.dbPath), { recursive: true });
    const tmpPath = `${this.dbPath}.tmp`;
    await writeFile(tmpPath, JSON.stringify(this.state, null, 2));
    await rename(tmpPath, this.dbPath);
  }

  addCheckIns(records: CheckInRecord[]): number {
    let added = 0;
    for (const record of records) {
      if (this.apply(record, true)) {
        added += 1;
      }
    }
    return added;
  }

  getFeed(limit: number, cursor?: string): FeedPage {
    const decoded = cursor ? decodeCursor(cursor) : null;
    const ordered = [...this.state.checkIns].sort(compareNewestFirst);
    const filtered = decoded
      ? ordered.filter((record) => isBeforeCursor(record, decoded))
      : ordered;
    const items = filtered.slice(0, limit);
    const last = items.at(-1);
    return {
      items: items.map(withIsoTimestamp),
      nextCursor:
        last && filtered.length > limit ? encodeCursor(last) : null,
    };
  }

  getProfile(memberInput: string, now = new Date()): MemberProfile {
    if (!isAddress(memberInput)) {
      throw new Error("member must be an EVM address");
    }
    const member = getAddress(memberInput);
    const days = this.daysByMember.get(member.toLowerCase()) ?? new Set<number>();
    const lastDay = days.size > 0 ? Math.max(...days) : null;
    const lastRecord =
      lastDay === null
        ? null
        : this.state.checkIns
            .filter(
              (record) =>
                record.member.toLowerCase() === member.toLowerCase() &&
                record.day === lastDay,
            )
            .sort(compareNewestFirst)[0] ?? null;

    return {
      member,
      currentStreak: this.computeCurrentStreak(member, now),
      totalCheckIns: days.size,
      lastCheckInDay: lastDay,
      lastCheckInAt: lastRecord ? isoFromUnix(lastRecord.timestamp) : null,
    };
  }

  getLeaderboard(month = currentUtcMonth(), limit = 50, now = new Date()): {
    month: string;
    items: LeaderboardEntry[];
  } {
    const { startDay, endDay } = parseMonth(month);
    const counts = new Map<string, number>();

    for (const record of this.state.checkIns) {
      if (record.day >= startDay && record.day < endDay) {
        const key = record.member.toLowerCase();
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }

    const items = [...counts.entries()]
      .map(([member]) => this.getProfile(member, now))
      .map((profile) => ({
        member: profile.member,
        checkIns: counts.get(profile.member.toLowerCase()) ?? 0,
        currentStreak: profile.currentStreak,
        totalCheckIns: profile.totalCheckIns,
        rank: 0,
      }))
      .sort((a, b) => {
        if (b.checkIns !== a.checkIns) return b.checkIns - a.checkIns;
        if (b.currentStreak !== a.currentStreak) return b.currentStreak - a.currentStreak;
        return a.member.localeCompare(b.member);
      })
      .slice(0, limit);

    return {
      month,
      items: items.map((item, index) => ({ ...item, rank: index + 1 })),
    };
  }

  onCheckIn(listener: (record: CheckInRecord & { checkedInAt: string }) => void): () => void {
    this.emitter.on("check-in", listener);
    return () => this.emitter.off("check-in", listener);
  }

  private apply(record: CheckInRecord, emit: boolean): boolean {
    if (this.byId.has(record.id)) {
      return false;
    }

    const normalized: CheckInRecord = {
      ...record,
      member: getAddress(record.member),
    };
    this.byId.set(normalized.id, normalized);
    this.state.checkIns.push(normalized);

    const memberKey = normalized.member.toLowerCase();
    const days = this.daysByMember.get(memberKey) ?? new Set<number>();
    days.add(normalized.day);
    this.daysByMember.set(memberKey, days);

    if (emit) {
      this.emitter.emit("check-in", withIsoTimestamp(normalized));
    }
    return true;
  }

  private computeCurrentStreak(member: string, now: Date): number {
    const days = this.daysByMember.get(member.toLowerCase());
    if (!days || days.size === 0) {
      return 0;
    }

    const today = dayFromDate(now);
    let day = days.has(today) ? today : today - 1;
    if (!days.has(day)) {
      return 0;
    }

    let streak = 0;
    while (days.has(day)) {
      streak += 1;
      day -= 1;
    }
    return streak;
  }
}

function compareNewestFirst(a: CheckInRecord, b: CheckInRecord): number {
  if (b.blockNumber !== a.blockNumber) return b.blockNumber - a.blockNumber;
  return b.logIndex - a.logIndex;
}

function withIsoTimestamp(record: CheckInRecord): CheckInRecord & { checkedInAt: string } {
  return {
    ...record,
    checkedInAt: isoFromUnix(record.timestamp),
  };
}
