import { createPublicClient, http } from "viem";
import { base } from "viem/chains";
import { config } from "./config.js";
import { checkedInEvent } from "./contract.js";
import { db } from "./db.js";
import type { PoolClient } from "pg";

const client = createPublicClient({ chain: base, transport: http(config.rpcUrl) });
const chunkSize = 2_000n;

const getCursor = async () => {
  const result = await db.query("SELECT value FROM indexer_state WHERE key = 'next_block'");
  return result.rowCount ? BigInt(result.rows[0].value) : config.startBlock;
};

const storeCursor = async (database: PoolClient, nextBlock: bigint) => {
  await database.query(
    "INSERT INTO indexer_state(key, value) VALUES ('next_block', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
    [nextBlock.toString()],
  );
};

export const syncOnce = async () => {
  const head = await client.getBlockNumber();
  const finalBlock = head > config.confirmations ? head - config.confirmations : 0n;
  let fromBlock = await getCursor();

  while (fromBlock <= finalBlock) {
    const toBlock = fromBlock + chunkSize - 1n > finalBlock ? finalBlock : fromBlock + chunkSize - 1n;
    const logs = await client.getLogs({ address: config.contractAddress, event: checkedInEvent, fromBlock, toBlock });
    const database = await db.connect();
    try {
      await database.query("BEGIN");
      for (const log of logs) {
        await database.query(
          `INSERT INTO checkins (transaction_hash, log_index, block_number, block_hash, block_timestamp, member, day, note)
           VALUES ($1,$2,$3,$4,to_timestamp($5),$6,$7,$8)
           ON CONFLICT (transaction_hash, log_index) DO NOTHING`,
          [log.transactionHash, Number(log.logIndex), log.blockNumber!.toString(), log.blockHash, Number(log.args.checkedInAt!), log.args.member!.toLowerCase(), log.args.day!.toString(), log.args.note!],
        );
      }
      await storeCursor(database, toBlock + 1n);
      await database.query("COMMIT");
    } catch (error) {
      await database.query("ROLLBACK");
      throw error;
    } finally { database.release(); }
    fromBlock = toBlock + 1n;
  }
};

const main = async () => {
  await syncOnce();
  await db.end();
};

if (import.meta.url === `file://${process.argv[1]}`) main().catch(error => { console.error(error); process.exit(1); });
