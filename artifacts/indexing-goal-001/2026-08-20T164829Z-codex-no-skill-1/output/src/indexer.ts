import { createPublicClient, http } from "viem";
import { base } from "viem/chains";
import { checkedInEvent } from "./contract.js";
import { config } from "./config.js";
import { db, migrate } from "./db.js";

const CHUNK_SIZE = 2_000n;

const client = createPublicClient({ chain: base, transport: http(config.rpcUrl) });

async function cursor() {
  const result = await db.query<{ next_block: string }>(
    "SELECT next_block FROM sync_state WHERE name = 'checkins'",
  );
  return result.rowCount ? BigInt(result.rows[0].next_block) : config.deploymentBlock;
}

type CheckedInLog = {
  blockNumber: bigint | null;
  blockHash: `0x${string}` | null;
  transactionHash: `0x${string}` | null;
  logIndex: number | null;
  args: { member?: `0x${string}`; day?: bigint; note?: string };
};

async function saveLog(log: CheckedInLog) {
  if (!log.blockNumber || !log.blockHash || !log.transactionHash || log.logIndex === null) return;
  const block = await client.getBlock({ blockHash: log.blockHash });
  const { member, day, note } = log.args;
  await db.query(
    `INSERT INTO checkins (transaction_hash, log_index, block_number, block_timestamp, member, day, note)
     VALUES ($1, $2, $3, to_timestamp($4), $5, $6, $7)
     ON CONFLICT (transaction_hash, log_index) DO NOTHING`,
    [log.transactionHash, Number(log.logIndex), log.blockNumber.toString(), Number(block.timestamp), member!.toLowerCase(), day!.toString(), note!],
  );
}

export async function syncOnce() {
  await migrate();
  let fromBlock = await cursor();
  const latest = await client.getBlockNumber();
  while (fromBlock <= latest) {
    const toBlock = fromBlock + CHUNK_SIZE - 1n > latest ? latest : fromBlock + CHUNK_SIZE - 1n;
    const logs = await client.getLogs({ address: config.contractAddress, event: checkedInEvent, fromBlock, toBlock });
    for (const log of logs) await saveLog(log);
    await db.query(
      `INSERT INTO sync_state (name, next_block) VALUES ('checkins', $1)
       ON CONFLICT (name) DO UPDATE SET next_block = EXCLUDED.next_block`,
      [(toBlock + 1n).toString()],
    );
    fromBlock = toBlock + 1n;
  }
}

async function main() {
  const once = process.argv.includes("--once");
  do {
    await syncOnce();
    if (!once) await new Promise(resolve => setTimeout(resolve, 12_000));
  } while (!once);
  await db.end();
}

main().catch(error => { console.error(error); process.exit(1); });
