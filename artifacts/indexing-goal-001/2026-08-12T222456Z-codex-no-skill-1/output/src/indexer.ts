import { createPublicClient, http, parseAbiItem } from "viem";
import { base } from "viem/chains";
import { config } from "./config.js";
import { openDatabase, resetIndexedState } from "./database.js";
import { applyCheckIn } from "./processor.js";

const client = createPublicClient({ chain: base, transport: http(config.rpcUrl) });
const db = openDatabase(config.databasePath);
const event = parseAbiItem("event CheckedIn(address indexed member, uint256 indexed day, string note)");
const getMeta = db.prepare("SELECT value FROM metadata WHERE key = ?");
const setMeta = db.prepare("INSERT OR REPLACE INTO metadata(key, value) VALUES (?, ?)");

async function validateCheckpoint() {
  const row = getMeta.get("last_block") as { value: string } | undefined;
  const hash = getMeta.get("last_block_hash") as { value: string } | undefined;
  if (!row || !hash) return;
  const block = await client.getBlock({ blockNumber: BigInt(row.value) });
  if (block.hash !== hash.value) {
    console.warn("Indexed checkpoint was reorganized; rebuilding from START_BLOCK");
    resetIndexedState(db);
  }
}

export async function syncOnce() {
  await validateCheckpoint();
  const last = getMeta.get("last_block") as { value: string } | undefined;
  let from = last ? BigInt(last.value) + 1n : config.startBlock;
  const head = await client.getBlockNumber();
  if (head < config.confirmations) return;
  const safeHead = head - config.confirmations;

  while (from <= safeHead) {
    const to = from + config.chunkSize - 1n < safeHead ? from + config.chunkSize - 1n : safeHead;
    const logs = await client.getLogs({ address: config.contractAddress, event, fromBlock: from, toBlock: to });
    const timestamps = new Map<bigint, number>();
    for (const blockNumber of new Set(logs.map(log => log.blockNumber))) {
      const block = await client.getBlock({ blockNumber });
      timestamps.set(blockNumber, Number(block.timestamp));
    }
    const checkpoint = await client.getBlock({ blockNumber: to });
    db.transaction(() => {
      for (const log of logs) {
        applyCheckIn(db, {
          id: `${log.transactionHash}:${log.logIndex}`,
          member: log.args.member!, day: Number(log.args.day!), note: log.args.note!,
          timestamp: timestamps.get(log.blockNumber)!, blockNumber: Number(log.blockNumber),
          transactionHash: log.transactionHash!, logIndex: log.logIndex
        });
      }
      setMeta.run("last_block", to.toString());
      setMeta.run("last_block_hash", checkpoint.hash);
    })();
    console.log(`Indexed ${from}-${to} (${logs.length} check-ins)`);
    from = to + 1n;
  }
}

async function main() {
  for (;;) {
    try { await syncOnce(); } catch (error) { console.error(error); }
    await new Promise(resolve => setTimeout(resolve, config.pollIntervalMs));
  }
}

if (process.argv[1]?.endsWith("indexer.ts")) void main();
