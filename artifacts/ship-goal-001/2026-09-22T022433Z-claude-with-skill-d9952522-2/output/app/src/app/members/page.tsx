import Link from 'next/link'
import { allTrackRecords } from '@/server/reputation'
import { outstandingLoans } from '@/server/loans'
import { displayNameFor } from '@/server/members'
import { chain, toolshedAddress } from '@/chain/config'
import { dateTime, reliabilityPercent, shortAddress, usdcLabel } from '@/ui/format'

export const dynamic = 'force-dynamic'

/**
 * The record book. Everything on this page is derived from contract events, so
 * any member can recompute it themselves from the chain.
 */
export default async function MembersPage() {
  const records = allTrackRecords()
  const outstanding = outstandingLoans()
  const overdue = outstanding.filter((loan) => loan.lateDaysNow > 0)

  return (
    <>
      <h1>Members</h1>
      <p className="muted">
        Ordered the same way the browse screen is: anyone holding an overdue tool drops to the
        bottom, then by on-time rate, then by how many loans they have taken.
      </p>

      <table>
        <thead>
          <tr>
            <th>Member</th>
            <th>Unit</th>
            <th>Loans</th>
            <th>Late</th>
            <th>On time</th>
            <th>Out now</th>
            <th>Lent out</th>
            <th>Roster</th>
          </tr>
        </thead>
        <tbody>
          {records.map((record) => (
            <tr key={record.address}>
              <td title={record.address}>
                {displayNameFor(record.address, record.displayName)}
                <span className="muted"> {shortAddress(record.address)}</span>
              </td>
              <td>{record.unitLabel || '—'}</td>
              <td>{record.borrowed}</td>
              <td>{record.lateReturns}</td>
              <td>{record.borrowed > 0 ? reliabilityPercent(record.reliability) : '—'}</td>
              <td>
                {record.activeLoans}
                {record.overdueNow > 0 ? (
                  <span style={{ color: 'var(--warn)' }}> ({record.overdueNow} overdue)</span>
                ) : null}
              </td>
              <td>{record.lent}</td>
              <td className="muted">{record.onRoster ? 'yes' : 'no'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Overdue right now</h2>
      {overdue.length === 0 ? (
        <p className="muted">Nothing overdue. Rare and worth celebrating.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Tool</th>
              <th>Borrower</th>
              <th>Was due</th>
              <th>Late days billed</th>
              <th>Fee so far</th>
            </tr>
          </thead>
          <tbody>
            {overdue.map((loan) => (
              <tr key={loan.loanId}>
                <td>
                  {loan.tool ? (
                    <Link href={`/tools/${loan.tool.uuid}`}>{loan.tool.title}</Link>
                  ) : (
                    `#${loan.loanId}`
                  )}
                </td>
                <td>{displayNameFor(loan.borrowerAddress, loan.borrower.displayName)}</td>
                <td>{dateTime(loan.dueAt)}</td>
                <td>
                  {loan.lateDaysNow} / {loan.maxLateDays}
                </td>
                <td>{usdcLabel(loan.lateFeePerDay * BigInt(loan.lateDaysNow))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2>Joining</h2>
      <p className="muted">
        The roster lives in the Toolshed contract on {chain.name} (
        <code>{shortAddress(toolshedAddress)}</code>). The association steward adds and removes
        members; the app only mirrors what the contract says. New neighbours: give the steward your
        wallet address, then <Link href="/profile">add your name</Link>.
      </p>
    </>
  )
}
