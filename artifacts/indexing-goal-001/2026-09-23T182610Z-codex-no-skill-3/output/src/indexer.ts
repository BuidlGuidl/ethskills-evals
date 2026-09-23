import { createPublicClient, http, type Address, type Hex, type Log } from "viem";

import { checkInEvent } from "./abi.js";
import { loadConfig, type AppConfig } from "./config.js";
import { StreakStore, type CheckInRecord } from "./db.js";

type IndexerOptions = {
  config: AppConfig;
  store: StreakStore;
};

export class StreakIndexer {
  private readonly client: ReturnType<typeof createPublicClient>;
  private readonly config: AppConfig;
  private readonly store: StreakStore;

  constructor({ config, store }: IndexerOptions) {
    this.config = config;
    this.store = store;
    this.client = createPublicClient({
      transport: http(config.rpcUrl),
    });
  }

  async backfillOnce() {
    const latest = await this.client.getBlockNumber();
    const target = latest > this.config.confirmations ? latest - this.config.confirmations : 0n;
    let fromBlock = (this.store.lastScannedBlock() ?? (this.config.startBlock - 1n)) + 1n;

    if (fromBlock < this.config.startBlock) {
      fromBlock = this.config.startBlock;
    }

    while (fromBlock <= target) {
      const toBlock = minBigInt(fromBlock + this.config.chunkSize - 1n, target);

      const logs = await this.client.getLogs({
        address: this.config.contractAddress,
        event: checkInEvent,
        fromBlock,
        toBlock,
      });

      await this.ingestLogs(logs);
      this.store.setLastScannedBlock(toBlock);
      fromBlock = toBlock + 1n;
    }

    return { latestBlock: latest, indexedThroughBlock: target };
  }

  async ingestLogs(logs: Log[]) {
    if (logs.length === 0) {
      return 0;
    }

    const orderedLogs = [...logs].sort((a, b) => {
      const blockDelta = Number((a.blockNumber ?? 0n) - (b.blockNumber ?? 0n));
      return blockDelta === 0 ? (a.logIndex ?? 0) - (b.logIndex ?? 0) : blockDelta;
    });

    const blockTimestamps = await this.blockTimestampMap(orderedLogs);
    let inserted = 0;

    for (const log of orderedLogs) {
      const args = (log as { args?: { member?: Address; day?: bigint; note?: string } }).args ?? {};

      if (
        !args.member ||
        args.day === undefined ||
        log.blockNumber === null ||
        log.blockHash === null ||
        log.transactionHash === null ||
        log.logIndex === null
      ) {
        continue;
      }

      const checkedInAt = blockTimestamps.get(log.blockNumber.toString());
      if (checkedInAt === undefined) {
        throw new Error(`Missing timestamp for block ${log.blockNumber}`);
      }

      const record: CheckInRecord = {
        member: args.member,
        day: Number(args.day),
        note: args.note ?? "",
        blockNumber: log.blockNumber,
        blockHash: log.blockHash as Hex,
        transactionHash: log.transactionHash as Hex,
        logIndex: log.logIndex,
        checkedInAt,
      };

      if (this.store.insertCheckIn(record)) {
        inserted += 1;
      }
    }

    return inserted;
  }

  private async blockTimestampMap(logs: Log[]) {
    const uniqueBlocks = new Set(
      logs
        .map((log) => log.blockNumber)
        .filter((blockNumber): blockNumber is bigint => blockNumber !== null),
    );

    const entries = await Promise.all(
      [...uniqueBlocks].map(async (blockNumber) => {
        const block = await this.client.getBlock({ blockNumber });
        return [blockNumber.toString(), Number(block.timestamp)] as const;
      }),
    );

    return new Map(entries);
  }
}

export async function startIndexerLoop(indexer: StreakIndexer, pollMs: number, signal?: AbortSignal) {
  while (!signal?.aborted) {
    try {
      const result = await indexer.backfillOnce();
      console.log(
        `indexed through block ${result.indexedThroughBlock.toString()} (chain latest ${result.latestBlock.toString()})`,
      );
    } catch (error) {
      console.error("indexer pass failed", error);
    }

    await sleep(pollMs, signal);
  }
}

function minBigInt(a: bigint, b: bigint) {
  return a < b ? a : b;
}

function sleep(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve) => {
    if (signal?.aborted) {
      resolve();
      return;
    }

    const timeout = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timeout);
        resolve();
      },
      { once: true },
    );
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const config = loadConfig();
  const store = new StreakStore(config.databasePath);
  const indexer = new StreakIndexer({ config, store });

  process.once("SIGINT", () => {
    store.close();
    process.exit(0);
  });

  await startIndexerLoop(indexer, config.pollMs);
}
