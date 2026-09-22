import { fileURLToPath } from "node:url";
import { parseAbiItem, type Address, type Log } from "viem";
import { db, nowSeconds } from "../core/db";
import { deployBlock, publicClient, toolshedAddress } from "../core/chain";

/**
 * Pulls Toolshed events into SQLite so the app can render loan state and
 * compute track records without hitting the chain on every page view.
 *
 * The `loans` table is a pure cache: delete the database file, restart, and it
 * rebuilds itself from `TOOLSHED_DEPLOY_BLOCK` onwards. Nothing here is a
 * source of truth.
 *
 * Run alongside the web server:  npm run indexer
 */

const CONFIRMATIONS = BigInt(process.env.INDEXER_CONFIRMATIONS ?? "2");
const BATCH_SIZE = BigInt(process.env.INDEXER_BATCH_SIZE ?? "2000");
const POLL_MS = Number(process.env.INDEXER_POLL_MS ?? "5000");

const EVENTS = [
  parseAbiItem(
    "event LoanRequested(uint256 indexed loanId, address indexed owner, address indexed borrower, bytes32 listingRef, uint256 deposit, uint256 dailyLateFee, uint32 durationDays)",
  ),
  parseAbiItem("event LoanApproved(uint256 indexed loanId, address indexed owner, address indexed borrower, uint64 dueAt)"),
  parseAbiItem("event LoanCancelled(uint256 indexed loanId, address indexed owner, address indexed borrower, address by)"),
  parseAbiItem(
    "event ReturnAsserted(uint256 indexed loanId, address indexed borrower, uint64 assertedAt, uint64 challengeEndsAt)",
  ),
  parseAbiItem("event ReturnObjected(uint256 indexed loanId, address indexed owner)"),
  parseAbiItem(
    "event LoanSettled(uint256 indexed loanId, address indexed owner, address indexed borrower, uint256 lateFee, uint256 refund, uint256 daysLate, bool unreturned)",
  ),
] as const;

type AnyLog = Log<bigint, number, false, undefined, true, typeof EVENTS>;

function lastBlock(): bigint {
  const row = db().prepare("SELECT last_block FROM indexer_state WHERE id = 1").get() as
    | { last_block: string }
    | undefined;
  return row ? BigInt(row.last_block) : deployBlock;
}

function setLastBlock(block: bigint) {
  db()
    .prepare(
      `INSERT INTO indexer_state (id, last_block, updated_at) VALUES (1, ?, ?)
       ON CONFLICT(id) DO UPDATE SET last_block = excluded.last_block, updated_at = excluded.updated_at`,
    )
    .run(block.toString(), nowSeconds());
}

/** A member row is created on first sight so unknown addresses still render. */
function ensureMember(address: Address) {
  db()
    .prepare(
      `INSERT INTO members (address, display_name, approved, joined_at)
       VALUES (?, ?, 0, ?) ON CONFLICT(address) DO NOTHING`,
    )
    .run(address.toLowerCase(), `${address.slice(0, 6)}…${address.slice(-4)}`, nowSeconds());
}

function applyLog(log: AnyLog, blockTime: number) {
  const conn = db();
  const args = log.args as Record<string, unknown>;
  const loanId = Number(args.loanId as bigint);

  switch (log.eventName) {
    case "LoanRequested": {
      const owner = args.owner as Address;
      const borrower = args.borrower as Address;
      ensureMember(owner);
      ensureMember(borrower);
      conn
        .prepare(
          `INSERT INTO loans (loan_id, owner_address, borrower_address, listing_ref, deposit,
                              daily_late_fee, duration_days, status, requested_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'requested', ?)
           ON CONFLICT(loan_id) DO NOTHING`,
        )
        .run(
          loanId,
          owner.toLowerCase(),
          borrower.toLowerCase(),
          args.listingRef as string,
          (args.deposit as bigint).toString(),
          (args.dailyLateFee as bigint).toString(),
          Number(args.durationDays as number),
          blockTime,
        );
      // Resolve which listing this was for, if we can match the hash.
      conn
        .prepare(
          `INSERT INTO loan_listings (loan_id, listing_id)
           SELECT ?, id FROM listings WHERE listing_ref = ?
           ON CONFLICT(loan_id) DO NOTHING`,
        )
        .run(loanId, args.listingRef as string);
      break;
    }
    case "LoanApproved":
      conn
        .prepare("UPDATE loans SET status = 'active', due_at = ? WHERE loan_id = ?")
        .run(Number(args.dueAt as bigint), loanId);
      break;
    case "LoanCancelled":
      conn.prepare("UPDATE loans SET status = 'cancelled' WHERE loan_id = ?").run(loanId);
      break;
    case "ReturnAsserted":
      conn
        .prepare(
          "UPDATE loans SET status = 'return_asserted', asserted_at = ?, challenge_ends_at = ? WHERE loan_id = ?",
        )
        .run(Number(args.assertedAt as bigint), Number(args.challengeEndsAt as bigint), loanId);
      break;
    case "ReturnObjected":
      conn
        .prepare(
          "UPDATE loans SET status = 'active', objected = 1, asserted_at = NULL, challenge_ends_at = NULL WHERE loan_id = ?",
        )
        .run(loanId);
      break;
    case "LoanSettled":
      conn
        .prepare(
          `UPDATE loans SET status = 'settled', late_fee_paid = ?, refund = ?, days_late = ?,
                            unreturned = ?, settled_at = ? WHERE loan_id = ?`,
        )
        .run(
          (args.lateFee as bigint).toString(),
          (args.refund as bigint).toString(),
          Number(args.daysLate as bigint),
          (args.unreturned as boolean) ? 1 : 0,
          blockTime,
          loanId,
        );
      break;
  }
}

export async function indexOnce(): Promise<{ from: bigint; to: bigint; logs: number }> {
  const head = await publicClient.getBlockNumber();
  const safeHead = head > CONFIRMATIONS ? head - CONFIRMATIONS : 0n;
  const from = lastBlock() + 1n;

  if (from > safeHead) return { from, to: safeHead, logs: 0 };

  const to = from + BATCH_SIZE - 1n > safeHead ? safeHead : from + BATCH_SIZE - 1n;

  const logs = (await publicClient.getLogs({
    address: toolshedAddress,
    events: EVENTS,
    fromBlock: from,
    toBlock: to,
  })) as AnyLog[];

  // Event timestamps come from the block, not from the clock on whatever
  // machine happens to be indexing, so a backfill and a live run agree.
  const blockTimes = new Map<bigint, number>();
  for (const blockNumber of new Set(logs.map((l) => l.blockNumber))) {
    const block = await publicClient.getBlock({ blockNumber });
    blockTimes.set(blockNumber, Number(block.timestamp));
  }

  // One transaction per batch: either the whole range lands with its bookmark
  // or neither does, so a crash mid-batch cannot skip events.
  db().transaction(() => {
    for (const log of logs) applyLog(log, blockTimes.get(log.blockNumber) ?? nowSeconds());
    setLastBlock(to);
  })();

  return { from, to, logs: logs.length };
}

async function main() {
  if (!toolshedAddress) throw new Error("NEXT_PUBLIC_TOOLSHED_ADDRESS is not set");
  console.log(`indexing ${toolshedAddress} from block ${lastBlock() + 1n}`);

  for (;;) {
    try {
      const { from, to, logs } = await indexOnce();
      if (logs > 0) console.log(`blocks ${from}-${to}: ${logs} events`);
    } catch (err) {
      console.error("index error:", err instanceof Error ? err.message : err);
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
}

const isEntrypoint = process.argv[1] === fileURLToPath(import.meta.url);
if (isEntrypoint) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
