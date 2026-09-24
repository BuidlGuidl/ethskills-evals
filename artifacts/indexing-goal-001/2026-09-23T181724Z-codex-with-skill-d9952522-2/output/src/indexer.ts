import { createPublicClient, http, parseAbiItem, type Log } from "viem";
import { base } from "viem/chains";
import { loadConfig } from "./config.js";
import { createPool, getLastIndexedBlock, initSchema, setLastIndexedBlock } from "./db.js";
import { recordCheckIn, type IndexedCheckIn } from "./readModel.js";
import { monthKeyFromUnixSeconds } from "./time.js";

const checkedInEvent = parseAbiItem("event CheckedIn(address indexed member, uint64 indexed day, uint64 timestamp, string note)");

type CheckedInLog = Log<bigint, number, false, typeof checkedInEvent, true>;

async function main(): Promise<void> {
  const config = loadConfig();
  const pool = createPool(config.DATABASE_URL);
  await initSchema(pool);

  const chainClient = createPublicClient({
    chain: base,
    transport: http(config.RPC_URL),
  });

  console.log(`Indexing ${config.CONTRACT_ADDRESS} from Base block ${config.START_BLOCK}`);

  while (true) {
    const latestBlock = await chainClient.getBlockNumber();
    const targetBlock = latestBlock > config.CONFIRMATIONS ? latestBlock - config.CONFIRMATIONS : 0n;
    const storedBlock = await getLastIndexedBlock(pool);
    let fromBlock = storedBlock === null ? config.START_BLOCK : storedBlock + 1n;

    while (fromBlock <= targetBlock) {
      const toBlock = minBigInt(fromBlock + config.BLOCK_CHUNK_SIZE - 1n, targetBlock);
      const logs = await chainClient.getLogs({
        address: config.CONTRACT_ADDRESS,
        event: checkedInEvent,
        fromBlock,
        toBlock,
      });

      await persistBlockRange(pool, logs as CheckedInLog[], toBlock);
      console.log(`Indexed blocks ${fromBlock}-${toBlock} (${logs.length} check-ins)`);
      fromBlock = toBlock + 1n;
    }

    await sleep(config.POLL_INTERVAL_MS);
  }
}

async function persistBlockRange(pool: ReturnType<typeof createPool>, logs: CheckedInLog[], toBlock: bigint): Promise<void> {
  const sortedLogs = [...logs].sort((a: CheckedInLog, b: CheckedInLog) => {
    if (a.blockNumber === b.blockNumber) return a.logIndex - b.logIndex;
    return a.blockNumber < b.blockNumber ? -1 : 1;
  });

  const client = await pool.connect();
  try {
    await client.query("begin");

    for (const log of sortedLogs) {
      if (!log.args.member || log.args.day === undefined || log.args.timestamp === undefined || log.args.note === undefined) {
        continue;
      }

      const checkIn: IndexedCheckIn = {
        id: `${log.blockNumber.toString()}:${log.logIndex}`,
        member: log.args.member.toLowerCase(),
        dayUtc: Number(log.args.day),
        checkedInAt: new Date(Number(log.args.timestamp) * 1000).toISOString(),
        timestampUnix: log.args.timestamp.toString(),
        note: log.args.note,
        txHash: log.transactionHash,
        blockNumber: log.blockNumber.toString(),
        logIndex: log.logIndex,
        monthKey: monthKeyFromUnixSeconds(log.args.timestamp),
      };

      await recordCheckIn(client, checkIn);
    }

    await setLastIndexedBlock(client, toBlock);
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

function minBigInt(a: bigint, b: bigint): bigint {
  return a < b ? a : b;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
