import { createPublicClient, getAddress, http, parseAbiItem } from "viem";
import { base, baseSepolia } from "viem/chains";
import { loadConfig, type AppConfig } from "./config.js";
import { StreakStore } from "./store.js";
import type { CheckInEvent } from "./types.js";

const checkedInEvent = parseAbiItem(
  "event CheckedIn(address indexed member, uint256 indexed day, uint256 timestamp, string note)",
);

const chains = {
  8453: base,
  84532: baseSepolia,
} as const;

export class StreakIndexer {
  private stopped = false;
  private readonly client;

  constructor(
    private readonly config: AppConfig,
    private readonly store: StreakStore,
  ) {
    this.client = createPublicClient({
      chain: chains[config.CHAIN_ID as keyof typeof chains] ?? undefined,
      transport: http(config.RPC_URL),
    });
  }

  async syncOnce(): Promise<{ fromBlock: bigint; toBlock: bigint; inserted: number }> {
    const latest = await this.client.getBlockNumber();
    const safeLatest =
      latest > this.config.CONFIRMATIONS ? latest - this.config.CONFIRMATIONS : 0n;
    const lastIndexed = this.store.getLastIndexedBlock();
    let fromBlock = lastIndexed == null ? this.config.START_BLOCK : lastIndexed + 1n;
    let inserted = 0;

    if (fromBlock > safeLatest) {
      return { fromBlock, toBlock: safeLatest, inserted };
    }

    const firstBlock = fromBlock;
    while (fromBlock <= safeLatest) {
      const toBlock = minBigInt(
        fromBlock + this.config.MAX_BLOCK_RANGE - 1n,
        safeLatest,
      );
      const logs = await this.client.getLogs({
        address: getAddress(this.config.CONTRACT_ADDRESS),
        event: checkedInEvent,
        fromBlock,
        toBlock,
      });

      inserted += this.store.ingestCheckIns(
        logs.map((log) => {
          const { member, day, timestamp, note } = log.args;
          if (
            member == null ||
            day == null ||
            timestamp == null ||
            note == null ||
            log.blockNumber == null ||
            log.transactionHash == null ||
            log.logIndex == null
          ) {
            throw new Error("RPC returned an incomplete log");
          }

          return {
            id: `${log.transactionHash}:${log.logIndex}`,
            member: getAddress(member) as `0x${string}`,
            note,
            day: Number(day),
            timestamp: Number(timestamp),
            blockNumber: Number(log.blockNumber),
            txHash: log.transactionHash,
            logIndex: log.logIndex,
          } satisfies CheckInEvent;
        }),
      );
      this.store.setLastIndexedBlock(toBlock);
      fromBlock = toBlock + 1n;
    }

    return { fromBlock: firstBlock, toBlock: safeLatest, inserted };
  }

  async startPolling(): Promise<void> {
    while (!this.stopped) {
      try {
        const result = await this.syncOnce();
        console.log(
          JSON.stringify({
            level: "info",
            message: "sync complete",
            fromBlock: result.fromBlock.toString(),
            toBlock: result.toBlock.toString(),
            inserted: result.inserted,
          }),
        );
      } catch (error) {
        console.error(
          JSON.stringify({
            level: "error",
            message: error instanceof Error ? error.message : String(error),
          }),
        );
      }

      await sleep(this.config.POLL_INTERVAL_MS);
    }
  }

  stop(): void {
    this.stopped = true;
  }
}

function minBigInt(a: bigint, b: bigint): bigint {
  return a < b ? a : b;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const config = loadConfig();
  const store = new StreakStore(config.DATABASE_PATH);
  const indexer = new StreakIndexer(config, store);

  process.on("SIGINT", () => {
    indexer.stop();
    store.close();
    process.exit(0);
  });

  await indexer.startPolling();
}
