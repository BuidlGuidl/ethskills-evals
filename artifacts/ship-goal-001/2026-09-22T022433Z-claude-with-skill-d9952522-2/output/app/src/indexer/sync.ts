import { parseAbiItem, type Address, type Hex } from 'viem'
import { publicClient } from '../server/chainClient'
import { toolshedAddress } from '../chain/config'
import { db, migrate, now } from '../server/db'
import { setRosterFlag } from '../server/members'
import { getToolByToolId } from '../server/tools'
import type { LoanRoute } from '../server/loans'
import { readCursor, writeCursor } from '../server/indexerState'

/**
 * The indexer is the only writer of the `loans` table and of
 * `members.on_roster`: everything the app shows about money and membership is a
 * projection of contract events, so the app can never disagree with the chain
 * about who owes what.
 *
 * It is idempotent — re-running it over the same range produces the same rows —
 * so recovery is "delete the cursor and run it again", and a reorg heals on the
 * next pass.
 */

const LOAN_STARTED = parseAbiItem(
  'event LoanStarted(uint256 indexed loanId, bytes32 indexed toolId, address indexed owner, address borrower, uint256 deposit, uint256 lateFeePerDay, uint64 startedAt, uint64 dueAt, uint32 maxLateDays)',
)

const LOAN_SETTLED = parseAbiItem(
  'event LoanSettled(uint256 indexed loanId, bytes32 indexed toolId, address indexed owner, address borrower, uint64 returnedAt, uint32 lateDays, uint256 lateFee, uint256 refund, uint8 route, address settledBy)',
)

const MEMBER_SET = parseAbiItem('event MemberSet(address indexed member, bool isMember)')

const ROUTES: LoanRoute[] = [
  'owner_confirmed',
  'borrower_receipt',
  'borrower_max_late',
  'steward_resolved',
]

/** Leave a couple of blocks unindexed so a shallow reorg does not need undoing. */
const CONFIRMATIONS = BigInt(process.env.INDEXER_CONFIRMATIONS ?? 2)

/** Block the contract was deployed in; scanning from 0 on a public RPC is slow and pointless. */
function deployBlock(): bigint {
  return BigInt(process.env.NEXT_PUBLIC_DEPLOY_BLOCK ?? process.env.DEPLOY_BLOCK ?? 0)
}

const CHUNK = BigInt(process.env.INDEXER_CHUNK ?? 9_000)

function upsertLoanStarted(log: {
  args: {
    loanId?: bigint
    toolId?: Hex
    owner?: Address
    borrower?: Address
    deposit?: bigint
    lateFeePerDay?: bigint
    startedAt?: bigint
    dueAt?: bigint
    maxLateDays?: number
  }
  blockNumber: bigint | null
}): void {
  const a = log.args
  db()
    .prepare(
      `INSERT INTO loans (loan_id, tool_id, owner_address, borrower_address, deposit,
                          late_fee_per_day, started_at, due_at, max_late_days, status, started_block)
       VALUES (@loanId, @toolId, @owner, @borrower, @deposit, @lateFeePerDay, @startedAt,
               @dueAt, @maxLateDays, 'active', @block)
       ON CONFLICT(loan_id) DO UPDATE SET
         tool_id = excluded.tool_id, owner_address = excluded.owner_address,
         borrower_address = excluded.borrower_address, deposit = excluded.deposit,
         late_fee_per_day = excluded.late_fee_per_day, started_at = excluded.started_at,
         due_at = excluded.due_at, max_late_days = excluded.max_late_days,
         started_block = excluded.started_block`,
    )
    .run({
      loanId: Number(a.loanId),
      toolId: a.toolId,
      owner: a.owner,
      borrower: a.borrower,
      deposit: String(a.deposit),
      lateFeePerDay: String(a.lateFeePerDay),
      startedAt: Number(a.startedAt),
      dueAt: Number(a.dueAt),
      maxLateDays: Number(a.maxLateDays),
      block: log.blockNumber === null ? null : Number(log.blockNumber),
    })

  // Close out the offchain request this loan came from, so the owner's inbox and
  // the borrower's "my requests" screen follow the chain rather than the client.
  const tool = getToolByToolId(a.toolId as Hex)
  if (tool) {
    db()
      .prepare(
        `UPDATE borrow_requests SET status = 'started', loan_id = @loanId, updated_at = @now
          WHERE tool_uuid = @toolUuid AND borrower_address = @borrower
            AND status IN ('pending', 'offered')`,
      )
      .run({
        loanId: Number(a.loanId),
        now: now(),
        toolUuid: tool.uuid,
        borrower: a.borrower,
      })
  }
}

function upsertLoanSettled(log: {
  args: {
    loanId?: bigint
    returnedAt?: bigint
    lateDays?: number
    lateFee?: bigint
    refund?: bigint
    route?: number
  }
  blockNumber: bigint | null
}): void {
  const a = log.args
  db()
    .prepare(
      `UPDATE loans SET status = 'settled', returned_at = @returnedAt, late_days = @lateDays,
                        late_fee = @lateFee, refund = @refund, route = @route, settled_block = @block
        WHERE loan_id = @loanId`,
    )
    .run({
      loanId: Number(a.loanId),
      returnedAt: Number(a.returnedAt),
      lateDays: Number(a.lateDays),
      lateFee: String(a.lateFee),
      refund: String(a.refund),
      route: ROUTES[Number(a.route)] ?? 'owner_confirmed',
      block: log.blockNumber === null ? null : Number(log.blockNumber),
    })
}

export type SyncResult = { from: bigint; to: bigint; events: number }

/** Indexes one range and moves the cursor. Safe to call repeatedly. */
export async function syncOnce(): Promise<SyncResult> {
  migrate()

  // cacheTime 0: viem caches the head by default, which would make a tight
  // catch-up loop (or the smoke test) keep re-reading a stale block number.
  const head = await publicClient.getBlockNumber({ cacheTime: 0 })
  const safeHead = head > CONFIRMATIONS ? head - CONFIRMATIONS : 0n
  const from = readCursor() !== undefined ? readCursor()! + 1n : deployBlock()

  if (from > safeHead) return { from, to: safeHead, events: 0 }

  let events = 0
  for (let start = from; start <= safeHead; start += CHUNK) {
    const end = start + CHUNK - 1n > safeHead ? safeHead : start + CHUNK - 1n

    const [started, settled, roster] = await Promise.all([
      publicClient.getLogs({ address: toolshedAddress, event: LOAN_STARTED, fromBlock: start, toBlock: end }),
      publicClient.getLogs({ address: toolshedAddress, event: LOAN_SETTLED, fromBlock: start, toBlock: end }),
      publicClient.getLogs({ address: toolshedAddress, event: MEMBER_SET, fromBlock: start, toBlock: end }),
    ])

    const apply = db().transaction(() => {
      for (const log of roster) setRosterFlag(log.args.member as Address, Boolean(log.args.isMember))
      for (const log of started) upsertLoanStarted(log)
      for (const log of settled) upsertLoanSettled(log)
      writeCursor(end)
    })
    apply()

    events += started.length + settled.length + roster.length
  }

  return { from, to: safeHead, events }
}

