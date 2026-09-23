import { createPublicClient, http, type Address, type PublicClient } from "viem";
import { streakAbi } from "./abi.js";
import type { AppConfig } from "./config.js";
import type { CheckInRecord } from "./types.js";
import { StreakStore } from "./store.js";

export type IndexerStatus = {
  indexedToBlock: number;
  latestSafeBlock: number;
  isCatchingUp: boolean;
};

export class StreakIndexer {
  private latestSafeBlock = 0;
  private isCatchingUp = false;
  private pollTimer: NodeJS.Timeout | null = null;
  private unwatch: (() => void) | null = null;

  constructor(
    private readonly client: PublicClient,
    private readonly store: StreakStore,
    private readonly address: Address,
    private readonly confirmations: number,
    private readonly batchSize: number,
  ) {}

  static create(config: AppConfig, store: StreakStore): StreakIndexer {
    const client = createPublicClient({
      transport: http(config.STREAK_RPC_URL),
    });
    return new StreakIndexer(
      client,
      store,
      config.STREAK_CONTRACT_ADDRESS,
      config.STREAK_CONFIRMATIONS,
      config.STREAK_LOG_BATCH_SIZE,
    );
  }

  getStatus(): IndexerStatus {
    return {
      indexedToBlock: this.store.indexedToBlock,
      latestSafeBlock: this.latestSafeBlock,
      isCatchingUp: this.isCatchingUp,
    };
  }

  async start(): Promise<void> {
    await this.syncToLatest();
    this.startLiveWatch();
    this.pollTimer = setInterval(() => {
      void this.syncToLatest().catch((error) => {
        console.error("background sync failed", error);
      });
    }, 15_000);
  }

  async stop(): Promise<void> {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    if (this.unwatch) {
      this.unwatch();
      this.unwatch = null;
    }
    await this.store.flush();
  }

  async syncToLatest(): Promise<void> {
    if (this.isCatchingUp) {
      return;
    }
    this.isCatchingUp = true;
    try {
      const latest = Number(await this.client.getBlockNumber());
      const safeBlock = Math.max(0, latest - this.confirmations);
      this.latestSafeBlock = safeBlock;

      let from = this.store.indexedToBlock + 1;
      if (from > safeBlock) {
        return;
      }

      while (from <= safeBlock) {
        const to = Math.min(from + this.batchSize - 1, safeBlock);
        const records = await this.getCheckIns(from, to);
        this.store.addCheckIns(records);
        this.store.setIndexedToBlock(to);
        await this.store.flush();
        from = to + 1;
      }
    } finally {
      this.isCatchingUp = false;
    }
  }

  private startLiveWatch(): void {
    this.unwatch = this.client.watchContractEvent({
      address: this.address,
      abi: streakAbi,
      eventName: "CheckedIn",
      onLogs: (logs) => {
        const records = logs
          .filter((log) => !log.removed)
          .map((log) => logToRecord(log));
        if (records.length > 0) {
          this.store.addCheckIns(records);
          void this.store.flush().catch((error) => {
            console.error("live flush failed", error);
          });
        }
      },
      onError: (error) => {
        console.error("live watch failed", error);
      },
    });
  }

  private async getCheckIns(fromBlock: number, toBlock: number): Promise<CheckInRecord[]> {
    const logs = await this.client.getContractEvents({
      address: this.address,
      abi: streakAbi,
      eventName: "CheckedIn",
      fromBlock: BigInt(fromBlock),
      toBlock: BigInt(toBlock),
    });

    return logs.map(logToRecord).sort((a, b) => {
      if (a.blockNumber !== b.blockNumber) return a.blockNumber - b.blockNumber;
      return a.logIndex - b.logIndex;
    });
  }
}

function logToRecord(log: {
  args: {
    member?: Address;
    day?: bigint;
    timestamp?: bigint;
    note?: string;
  };
  blockNumber: bigint | null;
  transactionHash: `0x${string}` | null;
  logIndex: number | null;
}): CheckInRecord {
  if (
    !log.args.member ||
    log.args.day === undefined ||
    log.args.timestamp === undefined ||
    log.args.note === undefined ||
    log.blockNumber === null ||
    log.transactionHash === null ||
    log.logIndex === null
  ) {
    throw new Error("CheckedIn log is missing required fields");
  }

  return {
    id: `${log.transactionHash}:${log.logIndex}`,
    member: log.args.member,
    day: Number(log.args.day),
    timestamp: Number(log.args.timestamp),
    note: log.args.note,
    blockNumber: Number(log.blockNumber),
    transactionHash: log.transactionHash,
    logIndex: log.logIndex,
  };
}
