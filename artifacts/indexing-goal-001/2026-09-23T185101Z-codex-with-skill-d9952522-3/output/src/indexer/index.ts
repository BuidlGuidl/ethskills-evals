import { createPublicClient, http, type Address, type Hex } from "viem";
import { base } from "viem/chains";
import { loadConfig } from "../config.js";
import { checkInEvent } from "../contract/abi.js";
import { createPool } from "../db/client.js";
import { schemaSql } from "../db/schema.js";
import { monthStartFromDate } from "../shared/streak.js";

const config = loadConfig();
const pool = createPool(config);
const client = createPublicClient({
  chain: config.CHAIN_ID === base.id ? base : undefined,
  transport: http(config.RPC_URL),
});

type CheckInRow = {
  chainId: number;
  contractAddress: Address;
  blockNumber: bigint;
  blockHash: Hex;
  transactionHash: Hex;
  logIndex: number;
  member: Address;
  dayNumber: bigint;
  checkedAt: Date;
  note: string;
  currentStreak: number;
  totalCheckIns: number;
};

function stateId() {
  return `${config.CHAIN_ID}:${config.STREAK_CONTRACT_ADDRESS.toLowerCase()}`;
}

async function getStartBlock() {
  const result = await pool.query<{ last_indexed_block: string }>(
    "select last_indexed_block from indexer_state where id = $1",
    [stateId()],
  );
  if (result.rowCount) {
    return BigInt(result.rows[0].last_indexed_block) + 1n;
  }
  return BigInt(config.STREAK_DEPLOYMENT_BLOCK);
}

async function saveCursor(blockNumber: bigint) {
  await pool.query(
    `
    insert into indexer_state (id, last_indexed_block)
    values ($1, $2)
    on conflict (id) do update
      set last_indexed_block = excluded.last_indexed_block,
          updated_at = now()
    `,
    [stateId(), blockNumber.toString()],
  );
}

async function insertCheckIn(row: CheckInRow) {
  const dbClient = await pool.connect();
  try {
    await dbClient.query("begin");
    const inserted = await dbClient.query(
      `
      insert into check_ins (
        chain_id,
        contract_address,
        block_number,
        block_hash,
        transaction_hash,
        log_index,
        member,
        day_number,
        checked_at,
        note,
        current_streak_at_check_in,
        total_check_ins_at_check_in
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      on conflict do nothing
      returning transaction_hash
      `,
      [
        row.chainId,
        row.contractAddress.toLowerCase(),
        row.blockNumber.toString(),
        row.blockHash,
        row.transactionHash,
        row.logIndex,
        row.member.toLowerCase(),
        row.dayNumber.toString(),
        row.checkedAt,
        row.note,
        row.currentStreak,
        row.totalCheckIns,
      ],
    );

    if (inserted.rowCount) {
      await dbClient.query(
        `
        insert into members (member, last_check_in_day, current_streak, total_check_ins, last_checked_at)
        values ($1, $2, $3, $4, $5)
        on conflict (member) do update set
          last_check_in_day = excluded.last_check_in_day,
          current_streak = excluded.current_streak,
          total_check_ins = excluded.total_check_ins,
          last_checked_at = excluded.last_checked_at,
          updated_at = now()
        where members.last_check_in_day <= excluded.last_check_in_day
        `,
        [row.member.toLowerCase(), row.dayNumber.toString(), row.currentStreak, row.totalCheckIns, row.checkedAt],
      );

      await dbClient.query(
        `
        insert into monthly_counts (month_start, member, check_in_count, latest_check_in_at)
        values ($1, $2, 1, $3)
        on conflict (month_start, member) do update set
          check_in_count = monthly_counts.check_in_count + 1,
          latest_check_in_at = greatest(monthly_counts.latest_check_in_at, excluded.latest_check_in_at)
        `,
        [monthStartFromDate(row.checkedAt), row.member.toLowerCase(), row.checkedAt],
      );
    }

    await dbClient.query("commit");
  } catch (error) {
    await dbClient.query("rollback");
    throw error;
  } finally {
    dbClient.release();
  }
}

async function indexRange(fromBlock: bigint, toBlock: bigint) {
  const logs = await client.getLogs({
    address: config.STREAK_CONTRACT_ADDRESS,
    event: checkInEvent,
    fromBlock,
    toBlock,
  });

  logs.sort((a, b) => {
    if (a.blockNumber === b.blockNumber) {
      return a.logIndex - b.logIndex;
    }
    return a.blockNumber < b.blockNumber ? -1 : 1;
  });

  for (const log of logs) {
    const checkedAtSeconds = log.args.checkedAt;
    if (
      !log.blockHash ||
      !log.transactionHash ||
      log.logIndex === null ||
      !log.args.member ||
      log.args.dayNumber === undefined ||
      checkedAtSeconds === undefined ||
      log.args.note === undefined ||
      log.args.currentStreak === undefined ||
      log.args.totalCheckIns === undefined
    ) {
      throw new Error(`Malformed CheckIn log at block ${log.blockNumber.toString()}`);
    }

    await insertCheckIn({
      chainId: config.CHAIN_ID,
      contractAddress: config.STREAK_CONTRACT_ADDRESS,
      blockNumber: log.blockNumber,
      blockHash: log.blockHash,
      transactionHash: log.transactionHash,
      logIndex: log.logIndex,
      member: log.args.member,
      dayNumber: log.args.dayNumber,
      checkedAt: new Date(Number(checkedAtSeconds) * 1000),
      note: log.args.note,
      currentStreak: Number(log.args.currentStreak),
      totalCheckIns: Number(log.args.totalCheckIns),
    });
  }

  await saveCursor(toBlock);
  console.log(`Indexed ${logs.length} check-ins from blocks ${fromBlock.toString()}-${toBlock.toString()}`);
}

async function targetBlock() {
  const latest = await client.getBlockNumber();
  const finality = BigInt(config.FINALITY_BLOCKS);
  return latest > finality ? latest - finality : 0n;
}

async function runForever() {
  await pool.query(schemaSql);
  console.log(`Indexing ${stateId()} from deployment block ${config.STREAK_DEPLOYMENT_BLOCK}`);

  for (;;) {
    const target = await targetBlock();
    let fromBlock = await getStartBlock();

    while (fromBlock <= target) {
      const toBlock = fromBlock + BigInt(config.RPC_BLOCK_RANGE - 1) < target
        ? fromBlock + BigInt(config.RPC_BLOCK_RANGE - 1)
        : target;
      await indexRange(fromBlock, toBlock);
      fromBlock = toBlock + 1n;
    }

    await new Promise((resolve) => setTimeout(resolve, config.INDEXER_POLL_MS));
  }
}

process.once("SIGINT", async () => {
  await pool.end();
  process.exit(0);
});

process.once("SIGTERM", async () => {
  await pool.end();
  process.exit(0);
});

await runForever();
