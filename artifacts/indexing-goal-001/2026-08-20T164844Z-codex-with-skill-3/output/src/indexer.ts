import "dotenv/config";
import { createPublicClient, http, parseAbiItem } from "viem";
import { base } from "viem/chains";
import { migrate, pool, required } from "./db.js";

const event = parseAbiItem("event CheckedIn(address indexed member, uint64 indexed day, uint64 timestamp, uint64 currentStreak, uint64 totalCheckIns, string note)");
const address = required("STREAK_CONTRACT_ADDRESS") as `0x${string}`;
const startBlock = BigInt(required("STREAK_START_BLOCK"));
const confirmations = BigInt(process.env.INDEXER_CONFIRMATIONS ?? "8");
const pollMs = Number(process.env.INDEXER_POLL_MS ?? "12000");
const chunkSize = 2_000n;
const client = createPublicClient({ chain: base, transport: http(required("BASE_RPC_URL")) });

async function cursor() {
  const result = await pool.query<{ value: string }>("SELECT value FROM indexer_state WHERE name = 'next_block'");
  return result.rowCount ? BigInt(result.rows[0].value) : startBlock;
}

async function indexRange(fromBlock: bigint, toBlock: bigint) {
  const logs = await client.getLogs({ address, event, fromBlock, toBlock });
  const db = await pool.connect();
  try {
    await db.query("BEGIN");
    for (const log of logs) {
      const args = log.args;
      await db.query(
        `INSERT INTO checkins (transaction_hash, log_index, block_number, block_hash, member, day, checked_in_at, note)
         VALUES ($1,$2,$3,$4,$5,$6,to_timestamp($7),$8)
         ON CONFLICT (transaction_hash, log_index) DO NOTHING`,
        [log.transactionHash, Number(log.logIndex), log.blockNumber.toString(), log.blockHash, args.member!.toLowerCase(), args.day!.toString(), Number(args.timestamp!), args.note!]
      );
    }
    await db.query(
      `INSERT INTO indexer_state (name, value) VALUES ('next_block', $1)
       ON CONFLICT (name) DO UPDATE SET value = EXCLUDED.value`,
      [(toBlock + 1n).toString()]
    );
    await db.query("COMMIT");
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  } finally {
    db.release();
  }
}

async function tick() {
  const safeHead = (await client.getBlockNumber()) - confirmations;
  let next = await cursor();
  while (next <= safeHead) {
    const end = next + chunkSize - 1n > safeHead ? safeHead : next + chunkSize - 1n;
    await indexRange(next, end);
    next = end + 1n;
    console.info(`indexed Base blocks ${next - chunkSize}-${end}`);
  }
}

async function main() {
  await migrate();
  for (;;) {
    try { await tick(); } catch (error) { console.error("indexer tick failed", error); }
    await new Promise(resolve => setTimeout(resolve, pollMs));
  }
}

main().catch(error => { console.error(error); process.exit(1); });
