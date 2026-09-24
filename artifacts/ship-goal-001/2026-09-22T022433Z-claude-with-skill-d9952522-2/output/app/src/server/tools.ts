import { randomUUID } from 'node:crypto'
import { getAddress, type Address, type Hex } from 'viem'
import { db, now } from './db'
import { toolIdFor } from '../chain/eip712'
import { compareReliability, trackRecord, type TrackRecord } from './reputation'

export type Tool = {
  uuid: string
  toolId: Hex
  ownerAddress: Address
  title: string
  conditionNotes: string
  photoKey: string | null
  deposit: bigint
  lateFeePerDay: bigint
  maxLateDays: number
  maxLoanDays: number
  retired: boolean
  createdAt: number
}

export type ToolListing = Tool & {
  owner: TrackRecord
  /** Loan id if the tool is out right now. */
  activeLoanId: number | null
  activeLoanDueAt: number | null
  /** Settled loans this tool has been through. */
  completedLoans: number
}

type ToolRow = {
  uuid: string
  tool_id: string
  owner_address: string
  title: string
  condition_notes: string
  photo_key: string | null
  deposit: string
  late_fee_per_day: string
  max_late_days: number
  max_loan_days: number
  retired: number
  created_at: number
}

function toTool(row: ToolRow): Tool {
  return {
    uuid: row.uuid,
    toolId: row.tool_id as Hex,
    ownerAddress: row.owner_address as Address,
    title: row.title,
    conditionNotes: row.condition_notes,
    photoKey: row.photo_key,
    deposit: BigInt(row.deposit),
    lateFeePerDay: BigInt(row.late_fee_per_day),
    maxLateDays: row.max_late_days,
    maxLoanDays: row.max_loan_days,
    retired: row.retired === 1,
    createdAt: row.created_at,
  }
}

export function createTool(input: {
  ownerAddress: Address
  title: string
  conditionNotes: string
  photoKey: string | null
  deposit: bigint
  lateFeePerDay: bigint
  maxLateDays: number
  maxLoanDays: number
}): Tool {
  const uuid = randomUUID()
  db()
    .prepare(
      `INSERT INTO tools (uuid, tool_id, owner_address, title, condition_notes, photo_key,
                          deposit, late_fee_per_day, max_late_days, max_loan_days, created_at)
       VALUES (@uuid, @toolId, @ownerAddress, @title, @conditionNotes, @photoKey,
               @deposit, @lateFeePerDay, @maxLateDays, @maxLoanDays, @createdAt)`,
    )
    .run({
      uuid,
      toolId: toolIdFor(uuid),
      ownerAddress: getAddress(input.ownerAddress),
      title: input.title,
      conditionNotes: input.conditionNotes,
      photoKey: input.photoKey,
      deposit: input.deposit.toString(),
      lateFeePerDay: input.lateFeePerDay.toString(),
      maxLateDays: input.maxLateDays,
      maxLoanDays: input.maxLoanDays,
      createdAt: now(),
    })
  return getTool(uuid)!
}

export function getTool(uuid: string): Tool | undefined {
  const row = db().prepare<string, ToolRow>('SELECT * FROM tools WHERE uuid = ?').get(uuid)
  return row ? toTool(row) : undefined
}

export function getToolByToolId(toolId: Hex): Tool | undefined {
  const row = db().prepare<string, ToolRow>('SELECT * FROM tools WHERE tool_id = ?').get(toolId)
  return row ? toTool(row) : undefined
}

export function setToolRetired(uuid: string, retired: boolean): void {
  db().prepare('UPDATE tools SET retired = ? WHERE uuid = ?').run(retired ? 1 : 0, uuid)
}

function decorate(tool: Tool): ToolListing {
  const active = db()
    .prepare<string, { loan_id: number; due_at: number }>(
      "SELECT loan_id, due_at FROM loans WHERE tool_id = ? AND status = 'active' LIMIT 1",
    )
    .get(tool.toolId)
  const completed = db()
    .prepare<string, { n: number }>(
      "SELECT COUNT(*) AS n FROM loans WHERE tool_id = ? AND status = 'settled'",
    )
    .get(tool.toolId)!
  return {
    ...tool,
    owner: trackRecord(tool.ownerAddress),
    activeLoanId: active?.loan_id ?? null,
    activeLoanDueAt: active?.due_at ?? null,
    completedLoans: completed.n,
  }
}

export type BrowseSort = 'reliability' | 'newest'

/**
 * The browse screen.
 *
 * Default ordering is by the owner's track record, so the members who keep the
 * library working show up first; `newest` is there for people hunting for a
 * specific tool that just got listed. Both orderings happen here, in the app —
 * the contract has no idea what a ranking is.
 */
export function browseTools(options: { sort?: BrowseSort; query?: string } = {}): ToolListing[] {
  const rows = db()
    .prepare<[], ToolRow>('SELECT * FROM tools WHERE retired = 0 ORDER BY created_at DESC')
    .all()
  let listings = rows.map(toTool).map(decorate)

  const query = options.query?.trim().toLowerCase()
  if (query) {
    listings = listings.filter(
      (t) =>
        t.title.toLowerCase().includes(query) || t.conditionNotes.toLowerCase().includes(query),
    )
  }

  if ((options.sort ?? 'reliability') === 'reliability') {
    listings.sort((a, b) => compareReliability(a.owner, b.owner) || b.createdAt - a.createdAt)
  }
  return listings
}

export function toolsOwnedBy(address: Address): ToolListing[] {
  return db()
    .prepare<string, ToolRow>('SELECT * FROM tools WHERE owner_address = ? ORDER BY created_at DESC')
    .all(getAddress(address))
    .map(toTool)
    .map(decorate)
}

export function toolListing(uuid: string): ToolListing | undefined {
  const tool = getTool(uuid)
  return tool ? decorate(tool) : undefined
}
