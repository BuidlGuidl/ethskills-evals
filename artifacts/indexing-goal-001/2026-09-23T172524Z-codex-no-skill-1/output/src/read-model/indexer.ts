import { createPublicClient, http, type Address } from "viem";
import { checkInEventAbi } from "../contract/StreakAbi.js";
import type { AppConfig } from "./config.js";
import { ReadModelStore } from "./store.js";
import type { CheckInRecord } from "./types.js";

export type Indexer = {
  syncOnce: () => Promise<void>;
  start: () => void;
  stop: () => void;
};

export function createIndexer(config: AppConfig, store: ReadModelStore): Indexer {
  const client = createPublicClient({
    transport: http(config.rpcUrl)
  });

  let timer: NodeJS.Timeout | null = null;
  let syncing = false;

  async function syncOnce(): Promise<void> {
    if (syncing) {
      return;
    }

    syncing = true;
    try {
      await syncHistoricalRange();
    } finally {
      syncing = false;
    }
  }

  async function syncHistoricalRange(): Promise<void> {
    const latest = await client.getBlockNumber();
    if (latest <= config.confirmations) {
      return;
    }

    const safeLatest = latest - config.confirmations;
    let fromBlock = (store.cursorBlock ?? (config.startBlock - 1n)) + 1n;

    while (fromBlock <= safeLatest) {
      const toBlock = minBigInt(fromBlock + config.batchSize - 1n, safeLatest);
      const logs = await client.getLogs({
        address: config.contractAddress,
        event: checkInEventAbi,
        fromBlock,
        toBlock
      });

      const records = await Promise.all(
        logs.map(async (log) => {
          const block = await client.getBlock({ blockNumber: log.blockNumber });
          return {
            id: `${log.blockNumber.toString()}-${log.logIndex}`,
            member: log.args.member as Address,
            day: Number(log.args.day),
            timestamp: Number(block.timestamp),
            note: log.args.note ?? "",
            totalCheckInsAtEvent: Number(log.args.totalCheckIns),
            streakAtEvent: Number(log.args.streakAtCheckIn),
            blockNumber: log.blockNumber.toString(),
            blockHash: log.blockHash,
            transactionHash: log.transactionHash,
            logIndex: log.logIndex
          } satisfies CheckInRecord;
        })
      );

      const inserted = store.upsertMany(records);
      store.setCursor(toBlock);
      store.flush();

      if (inserted > 0) {
        console.log(`indexed ${inserted} check-in(s) through block ${toBlock.toString()}`);
      }

      fromBlock = toBlock + 1n;
    }
  }

  return {
    syncOnce,
    start() {
      void syncOnce().catch((error) => {
        console.error("initial sync failed", error);
      });

      timer = setInterval(() => {
        void syncOnce().catch((error) => {
          console.error("sync failed", error);
        });
      }, config.pollMs);
    },
    stop() {
      if (timer !== null) {
        clearInterval(timer);
      }
    }
  };
}

function minBigInt(a: bigint, b: bigint): bigint {
  return a < b ? a : b;
}
