import type { DatabaseSync } from "node:sqlite";
import { createPublicClient, decodeEventLog, http, type Address } from "viem";
import { base } from "viem/chains";
import { streakAbi } from "./abi.js";
import type { Config } from "./config.js";

export function makeClient(rpcUrl: string) {
  return createPublicClient({ chain: base, transport: http(rpcUrl) });
}

export class Indexer {
  constructor(
    private readonly db: DatabaseSync,
    private readonly client: ReturnType<typeof makeClient>,
    private readonly address: Address,
    private readonly deploymentBlock: bigint,
    private readonly confirmations: bigint,
    private readonly chunkSize: bigint,
  ) {}

  async sync() {
    await this.repairReorg();
    const chainHead = await this.client.getBlockNumber();
    if (chainHead < this.confirmations) return;
    const target = chainHead - this.confirmations;
    let next = this.lastBlock() + 1n;
    if (next < this.deploymentBlock) next = this.deploymentBlock;

    while (next <= target) {
      const to = next + this.chunkSize - 1n < target ? next + this.chunkSize - 1n : target;
      await this.indexRange(next, to);
      next = to + 1n;
    }
  }

  private lastBlock() {
    const row = this.db.prepare("SELECT MAX(number) AS number FROM indexed_blocks").get() as { number: number | null };
    return row.number === null ? this.deploymentBlock - 1n : BigInt(row.number);
  }

  private async repairReorg() {
    while (true) {
      const row = this.db.prepare("SELECT number, hash FROM indexed_blocks ORDER BY number DESC LIMIT 1").get() as
        | { number: number; hash: string }
        | undefined;
      if (!row) return;
      const canonical = await this.client.getBlock({ blockNumber: BigInt(row.number) });
      if (canonical.hash === row.hash) return;
      const rewindFrom = Math.max(Number(this.deploymentBlock), row.number - 99);
      this.db.exec("BEGIN IMMEDIATE");
      try {
        this.db.prepare("DELETE FROM check_ins WHERE block_number >= ?").run(rewindFrom);
        this.db.prepare("DELETE FROM indexed_blocks WHERE number >= ?").run(rewindFrom);
        this.db.exec("COMMIT");
      } catch (error) {
        this.db.exec("ROLLBACK");
        throw error;
      }
    }
  }

  private async indexRange(fromBlock: bigint, toBlock: bigint) {
    const [logs, finalBlock] = await Promise.all([
      this.client.getLogs({ address: this.address, event: streakAbi[0], fromBlock, toBlock }),
      this.client.getBlock({ blockNumber: toBlock }),
    ]);
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const insert = this.db.prepare(`
        INSERT OR IGNORE INTO check_ins
          (tx_hash, log_index, block_number, block_hash, member, day, timestamp, note)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const log of logs) {
        const decoded = decodeEventLog({ abi: streakAbi, data: log.data, topics: log.topics });
        if (decoded.eventName !== "CheckedIn" || log.blockNumber === null || log.blockHash === null || log.logIndex === null || log.transactionHash === null) continue;
        const { member, day, timestamp, note } = decoded.args;
        insert.run(log.transactionHash, log.logIndex, Number(log.blockNumber), log.blockHash, member.toLowerCase(), Number(day), Number(timestamp), note);
      }
      this.db.prepare("INSERT OR REPLACE INTO indexed_blocks(number, hash) VALUES (?, ?)").run(Number(toBlock), finalBlock.hash);
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
}

export function createIndexer(db: DatabaseSync, config: Config) {
  return new Indexer(db, makeClient(config.rpcUrl), config.address, config.deploymentBlock, config.confirmations, config.logChunkSize);
}
