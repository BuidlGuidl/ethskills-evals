import {createPublicClient, http, type Address, type Log, type PublicClient} from "viem";

import {db, migrate, normaliseAddress} from "@/server/db.ts";
import {markRequestOpened} from "@/server/requests.ts";
import {ToolshedEscrowAbi, chainConfig} from "@/contracts/config.ts";
import {OUTCOME_BY_INDEX} from "@/core/loan.ts";

/**
 * Turns ToolshedEscrow's events into rows the app can query.
 *
 * Why an indexer at all: the browse screen sorts 300 members by a track record derived from every
 * loan they have ever had. Computing that from `eth_call`s would be hundreds of round trips per
 * page load, and the contract deliberately stores no score to read. So the chain stays the source
 * of truth for money, and this keeps a local projection for reading.
 *
 * It is safe to delete `data/toolshed.db`'s `loans` table and replay from
 * `INDEXER_START_BLOCK` — every write here is an idempotent upsert keyed on the loan id.
 */

const LOG_CHUNK = 5_000n;

interface Cursor {
  from: bigint;
  to: bigint;
}

export function client(): PublicClient {
  const {chain, rpcUrl} = chainConfig();
  return createPublicClient({chain, transport: http(rpcUrl)}) as PublicClient;
}

function readCursor(fallback: bigint): bigint {
  const row = db()
    .prepare("SELECT value FROM indexer_state WHERE key = 'last_block'")
    .get() as {value: string} | undefined;
  return row ? BigInt(row.value) : fallback;
}

function writeCursor(block: bigint): void {
  db()
    .prepare(
      `INSERT INTO indexer_state (key, value) VALUES ('last_block', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    )
    .run(block.toString());
}

// ---------------------------------------------------------------- event handlers

type EventLog = Log<bigint, number, false> & {eventName: string; args: Record<string, unknown>};

function onLoanOpened(log: EventLog): void {
  const args = log.args as {
    loanId: string;
    owner: Address;
    borrower: Address;
    listingId: string;
    deposit: bigint;
    dailyLateFee: bigint;
    dueAt: bigint;
    startedAt: bigint;
  };

  db()
    .prepare(
      `INSERT INTO loans (loan_id, listing_id, owner_address, borrower_address, deposit,
                          daily_late_fee, due_at, started_at, status, opened_block, opened_tx)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)
       ON CONFLICT(loan_id) DO UPDATE SET opened_block = excluded.opened_block,
                                          opened_tx    = excluded.opened_tx`,
    )
    .run(
      args.loanId,
      args.listingId,
      normaliseAddress(args.owner),
      normaliseAddress(args.borrower),
      args.deposit.toString(),
      args.dailyLateFee.toString(),
      Number(args.dueAt),
      Number(args.startedAt),
      Number(log.blockNumber),
      log.transactionHash,
    );

  // The borrower collected the tool — the approval that authorised it is now spent.
  markRequestOpened(args.loanId);
}

function onLoanDisputed(log: EventLog): void {
  const args = log.args as {loanId: string};
  // Only an active loan can become disputed; never walk a closed loan backwards, which could
  // otherwise happen if logs arrive out of order after a reorg rewind.
  db()
    .prepare("UPDATE loans SET status = 'disputed' WHERE loan_id = ? AND status = 'active'")
    .run(args.loanId);
}

function onLoanClosed(log: EventLog): void {
  const args = log.args as {
    loanId: string;
    outcome: number;
    returnedAt: bigint;
    lateDays: bigint;
    ownerAmount: bigint;
    borrowerAmount: bigint;
  };

  db()
    .prepare(
      `UPDATE loans
          SET status = 'closed', outcome = ?, returned_at = ?, late_days = ?,
              owner_amount = ?, borrower_amount = ?, closed_block = ?, closed_tx = ?
        WHERE loan_id = ?`,
    )
    .run(
      OUTCOME_BY_INDEX[args.outcome] ?? null,
      args.returnedAt > 0n ? Number(args.returnedAt) : null,
      Number(args.lateDays),
      args.ownerAmount.toString(),
      args.borrowerAmount.toString(),
      Number(log.blockNumber),
      log.transactionHash,
      args.loanId,
    );
}

const HANDLERS: Record<string, (log: EventLog) => void> = {
  LoanOpened: onLoanOpened,
  LoanDisputed: onLoanDisputed,
  LoanClosed: onLoanClosed,
};

// ---------------------------------------------------------------- main loop

/** Fetches and applies every escrow log in [from, to]. Returns how many it handled. */
export async function indexRange(publicClient: PublicClient, range: Cursor): Promise<number> {
  const {escrowAddress} = chainConfig();
  let handled = 0;

  for (let from = range.from; from <= range.to; from += LOG_CHUNK) {
    const to = from + LOG_CHUNK - 1n > range.to ? range.to : from + LOG_CHUNK - 1n;
    // No event filter: we want all of them, and the escrow is low-traffic enough that the
    // decoding cost is irrelevant next to the RPC round trip.
    const decoded = (await publicClient.getContractEvents({
      address: escrowAddress,
      abi: ToolshedEscrowAbi,
      fromBlock: from,
      toBlock: to,
    })) as unknown as EventLog[];

    // One transaction per chunk: either the whole chunk lands and the cursor moves, or neither.
    const apply = db().transaction((batch: EventLog[]) => {
      for (const log of batch) {
        HANDLERS[log.eventName]?.(log);
        handled += 1;
      }
      writeCursor(to);
    });
    apply(decoded);
  }

  return handled;
}

/** One pass. Rewinds `INDEXER_CONFIRMATIONS` blocks so a reorg cannot strand a stale row. */
export async function indexOnce(publicClient: PublicClient): Promise<{head: bigint; handled: number}> {
  const startBlock = BigInt(process.env.INDEXER_START_BLOCK ?? "0");
  const confirmations = BigInt(process.env.INDEXER_CONFIRMATIONS ?? "12");

  const head = await publicClient.getBlockNumber();
  const cursor = readCursor(startBlock);
  const rewound = cursor > startBlock + confirmations ? cursor - confirmations : startBlock;

  if (rewound > head) return {head, handled: 0};
  const handled = await indexRange(publicClient, {from: rewound, to: head});
  return {head, handled};
}

/** Polls forever. `npm run indexer`. */
export async function run(): Promise<never> {
  migrate();
  const publicClient = client();
  const pollMs = Number(process.env.INDEXER_POLL_MS ?? "5000");
  const {escrowAddress, chainId} = chainConfig();

  console.log(`indexing ${escrowAddress} on chain ${chainId}, polling every ${pollMs}ms`);

  for (;;) {
    try {
      const {head, handled} = await indexOnce(publicClient);
      if (handled > 0) console.log(`block ${head}: applied ${handled} event(s)`);
    } catch (error) {
      // A flaky RPC should slow the indexer down, not kill it — it is the only thing keeping
      // the browse screen's track records current.
      console.error("index pass failed, retrying:", error);
    }
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
}
