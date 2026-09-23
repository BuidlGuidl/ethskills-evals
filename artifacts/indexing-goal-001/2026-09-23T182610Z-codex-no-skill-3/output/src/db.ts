import fs from "node:fs";
import path from "node:path";
import { getAddress, type Address, type Hex } from "viem";

import { calculateCurrentStreak, currentMonth, dayToDateString, monthBounds } from "./time.js";

export type CheckInRecord = {
  member: Address;
  day: number;
  note: string;
  blockNumber: bigint;
  blockHash: Hex;
  transactionHash: Hex;
  logIndex: number;
  checkedInAt: number;
};

export type Cursor = {
  blockNumber: number;
  logIndex: number;
};

type PersistedCheckIn = {
  member: string;
  day: number;
  note: string;
  blockNumber: number;
  blockHash: Hex;
  transactionHash: Hex;
  logIndex: number;
  checkedInAt: number;
};

type StoreState = {
  version: 1;
  metadata: Record<string, string>;
  checkIns: PersistedCheckIn[];
};

export class StreakStore {
  private readonly filename: string;
  private readonly state: StoreState;
  private readonly txLogKeys = new Set<string>();
  private readonly memberDayKeys = new Set<string>();

  constructor(filename: string) {
    this.filename = filename;
    this.state = this.load(filename);

    for (const checkIn of this.state.checkIns) {
      this.txLogKeys.add(txLogKey(checkIn.transactionHash, checkIn.logIndex));
      this.memberDayKeys.add(memberDayKey(checkIn.member, checkIn.day));
    }
  }

  close() {
    this.persist();
  }

  insertCheckIn(record: CheckInRecord): boolean {
    const checkIn: PersistedCheckIn = {
      member: record.member.toLowerCase(),
      day: record.day,
      note: record.note,
      blockNumber: Number(record.blockNumber),
      blockHash: record.blockHash,
      transactionHash: record.transactionHash,
      logIndex: record.logIndex,
      checkedInAt: record.checkedInAt,
    };

    const txKey = txLogKey(checkIn.transactionHash, checkIn.logIndex);
    const dayKey = memberDayKey(checkIn.member, checkIn.day);
    if (this.txLogKeys.has(txKey) || this.memberDayKeys.has(dayKey)) {
      return false;
    }

    this.state.checkIns.push(checkIn);
    this.txLogKeys.add(txKey);
    this.memberDayKeys.add(dayKey);
    this.persist();
    return true;
  }

  feed(limit = 50, before?: Cursor) {
    const boundedLimit = Math.min(Math.max(limit, 1), 100);

    return [...this.state.checkIns]
      .filter((checkIn) => {
        if (!before) {
          return true;
        }

        return (
          checkIn.blockNumber < before.blockNumber ||
          (checkIn.blockNumber === before.blockNumber && checkIn.logIndex < before.logIndex)
        );
      })
      .sort(descendingChainOrder)
      .slice(0, boundedLimit)
      .map(formatCheckIn);
  }

  checkInsAfter(cursor: Cursor, limit = 100) {
    return [...this.state.checkIns]
      .filter((checkIn) => {
        return (
          checkIn.blockNumber > cursor.blockNumber ||
          (checkIn.blockNumber === cursor.blockNumber && checkIn.logIndex > cursor.logIndex)
        );
      })
      .sort(ascendingChainOrder)
      .slice(0, limit)
      .map(formatCheckIn);
  }

  newestCursor(): Cursor {
    const newest = [...this.state.checkIns].sort(descendingChainOrder)[0];
    return newest ? { blockNumber: newest.blockNumber, logIndex: newest.logIndex } : { blockNumber: 0, logIndex: -1 };
  }

  memberProfile(member: Address, now = new Date()) {
    const normalized = member.toLowerCase();
    const memberCheckIns = this.state.checkIns
      .filter((checkIn) => checkIn.member === normalized)
      .sort((a, b) => b.day - a.day);
    const days = memberCheckIns.map((checkIn) => checkIn.day);

    return {
      member: getAddress(member),
      currentStreak: calculateCurrentStreak(days, now),
      totalCheckIns: memberCheckIns.length,
      lastCheckIn: memberCheckIns[0] ? formatCheckIn(memberCheckIns[0]) : null,
    };
  }

  monthlyLeaderboard(month = currentMonth(), limit = 100) {
    const { startDay, endDay } = monthBounds(month);
    const boundedLimit = Math.min(Math.max(limit, 1), 500);
    const totals = new Map<string, { checkIns: number; lastCheckedInAt: number }>();

    for (const checkIn of this.state.checkIns) {
      if (checkIn.day < startDay || checkIn.day >= endDay) {
        continue;
      }

      const current = totals.get(checkIn.member) ?? { checkIns: 0, lastCheckedInAt: 0 };
      current.checkIns += 1;
      current.lastCheckedInAt = Math.max(current.lastCheckedInAt, checkIn.checkedInAt);
      totals.set(checkIn.member, current);
    }

    return [...totals.entries()]
      .sort(([leftMember, left], [rightMember, right]) => {
        if (right.checkIns !== left.checkIns) {
          return right.checkIns - left.checkIns;
        }

        if (right.lastCheckedInAt !== left.lastCheckedInAt) {
          return right.lastCheckedInAt - left.lastCheckedInAt;
        }

        return leftMember.localeCompare(rightMember);
      })
      .slice(0, boundedLimit)
      .map(([member, entry], index) => ({
        rank: index + 1,
        member: getAddress(member),
        checkIns: entry.checkIns,
        lastCheckedInAt: new Date(entry.lastCheckedInAt * 1000).toISOString(),
      }));
  }

  getMeta(key: string): string | undefined {
    return this.state.metadata[key];
  }

  setMeta(key: string, value: string) {
    this.state.metadata[key] = value;
    this.persist();
  }

  lastScannedBlock() {
    const value = this.getMeta("last_scanned_block");
    return value === undefined ? undefined : BigInt(value);
  }

  setLastScannedBlock(blockNumber: bigint) {
    this.setMeta("last_scanned_block", blockNumber.toString());
  }

  private load(filename: string): StoreState {
    if (filename === ":memory:" || !fs.existsSync(filename)) {
      return { version: 1, metadata: {}, checkIns: [] };
    }

    return JSON.parse(fs.readFileSync(filename, "utf8")) as StoreState;
  }

  private persist() {
    if (this.filename === ":memory:") {
      return;
    }

    fs.mkdirSync(path.dirname(this.filename), { recursive: true });
    const temporaryFile = `${this.filename}.tmp`;
    fs.writeFileSync(temporaryFile, `${JSON.stringify(this.state, null, 2)}\n`, "utf8");
    fs.renameSync(temporaryFile, this.filename);
  }
}

function formatCheckIn(checkIn: PersistedCheckIn) {
  return {
    member: getAddress(checkIn.member),
    day: checkIn.day,
    date: dayToDateString(checkIn.day),
    note: checkIn.note,
    blockNumber: checkIn.blockNumber,
    blockHash: checkIn.blockHash,
    transactionHash: checkIn.transactionHash,
    logIndex: checkIn.logIndex,
    checkedInAt: new Date(checkIn.checkedInAt * 1000).toISOString(),
  };
}

function descendingChainOrder(left: PersistedCheckIn, right: PersistedCheckIn) {
  return right.blockNumber === left.blockNumber
    ? right.logIndex - left.logIndex
    : right.blockNumber - left.blockNumber;
}

function ascendingChainOrder(left: PersistedCheckIn, right: PersistedCheckIn) {
  return left.blockNumber === right.blockNumber
    ? left.logIndex - right.logIndex
    : left.blockNumber - right.blockNumber;
}

function txLogKey(transactionHash: Hex, logIndex: number) {
  return `${transactionHash}:${logIndex}`;
}

function memberDayKey(member: string, day: number) {
  return `${member.toLowerCase()}:${day}`;
}
