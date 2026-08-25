import { createPublicClient, http, parseAbiItem } from "viem";
import { base } from "viem/chains";
import type { StreakDb } from "./db.js";
import { getNextBlock, insertBatch } from "./db.js";
import { config } from "./config.js";

const event = parseAbiItem("event CheckedIn(address indexed member, uint256 indexed day, string note)");
const client = createPublicClient({ chain: base, transport: http(config.rpcUrl) });
const CHUNK = 5_000n;

export async function syncOnce(db: StreakDb) {
  let from = getNextBlock(db, config.startBlock);
  const head = await client.getBlockNumber();
  if (head < config.confirmations) return false;
  const safeHead = head - config.confirmations;
  if (from > safeHead) return false;
  const to = from + CHUNK - 1n < safeHead ? from + CHUNK - 1n : safeHead;
  const logs = await client.getLogs({ address: config.contract, event, fromBlock: from, toBlock: to });
  const timestamps = new Map<bigint, number>();
  for (const log of logs) {
    if (!timestamps.has(log.blockNumber)) {
      const block = await client.getBlock({ blockNumber: log.blockNumber });
      timestamps.set(log.blockNumber, Number(block.timestamp));
    }
  }
  insertBatch(db, logs.map(log => {
    if (!log.args.member || log.args.day === undefined || log.args.note === undefined) {
      throw new Error(`Malformed CheckedIn log ${log.transactionHash}`);
    }
    return {
      txHash: log.transactionHash,
      logIndex: log.logIndex,
      member: log.args.member.toLowerCase(),
      day: Number(log.args.day),
      note: log.args.note,
      blockNumber: Number(log.blockNumber),
      timestamp: timestamps.get(log.blockNumber)!
    };
  }), to + 1n);
  return true;
}

export async function backfill(db: StreakDb) {
  while (await syncOnce(db)) { /* drain historical chunks before serving */ }
}
