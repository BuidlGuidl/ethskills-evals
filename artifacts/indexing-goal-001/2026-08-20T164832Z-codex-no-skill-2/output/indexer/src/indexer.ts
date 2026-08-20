import type Database from "better-sqlite3";
import { createPublicClient, http, type Address } from "viem";
import { base } from "viem/chains";
import { checkedInEvent } from "./abi.js";

type IndexerOptions = { rpcUrl: string; contractAddress: Address; deploymentBlock: bigint; confirmations: bigint; db: Database.Database; getCursor: () => number; setCursor: (block: number) => void };

export const createIndexer = (options: IndexerOptions) => {
  const client = createPublicClient({ chain: base, transport: http(options.rpcUrl) });
  const insert = options.db.prepare(`INSERT OR IGNORE INTO checkins
    (account, day, note, timestamp, block_number, transaction_hash, log_index)
    VALUES (@account, @day, @note, @timestamp, @blockNumber, @transactionHash, @logIndex)`);

  const sync = async () => {
    const tip = await client.getBlockNumber();
    const safeTip = tip > options.confirmations ? tip - options.confirmations : 0n;
    let from = BigInt(Math.max(options.getCursor() + 1, Number(options.deploymentBlock)));
    const chunkSize = 2_000n;
    while (from <= safeTip) {
      const to = from + chunkSize - 1n > safeTip ? safeTip : from + chunkSize - 1n;
      const logs = await client.getLogs({ address: options.contractAddress, event: checkedInEvent, fromBlock: from, toBlock: to });
      const blockTimestamps = new Map<bigint, number>();
      for (const log of logs) {
        const block = log.blockNumber!;
        if (!blockTimestamps.has(block)) blockTimestamps.set(block, Number((await client.getBlock({ blockNumber: block })).timestamp));
      }
      const transaction = options.db.transaction(() => {
        for (const log of logs) insert.run({
          account: log.args.account!.toLowerCase(), day: Number(log.args.day), note: log.args.note!,
          timestamp: blockTimestamps.get(log.blockNumber!)!, blockNumber: Number(log.blockNumber!),
          transactionHash: log.transactionHash!, logIndex: Number(log.logIndex!),
        });
        options.setCursor(Number(to));
      });
      transaction();
      from = to + 1n;
    }
  };
  return { sync };
};

