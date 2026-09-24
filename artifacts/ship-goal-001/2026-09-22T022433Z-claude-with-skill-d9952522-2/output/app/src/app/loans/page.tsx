import Link from 'next/link'
import { getAddress } from 'viem'
import { currentMember } from '@/server/session'
import { loansFor } from '@/server/loans'
import { LoanActions } from '@/components/LoanActions'
import { TrackRecordBadge } from '@/components/TrackRecordBadge'
import { dateTime, relativeTime, usdcLabel } from '@/ui/format'

export const dynamic = 'force-dynamic'

const routeLabels: Record<string, string> = {
  owner_confirmed: 'owner confirmed the return',
  borrower_receipt: 'closed with the owner’s receipt',
  borrower_max_late: 'closed by the borrower at the capped late fee',
  steward_resolved: 'settled by the steward',
}

export default async function LoansPage() {
  const me = await currentMember()
  if (!me) return <p className="card">Sign in to see your loans.</p>

  const loans = loansFor(me)
  const active = loans.filter((loan) => loan.status === 'active')
  const settled = loans.filter((loan) => loan.status === 'settled')

  return (
    <>
      <h1>My loans</h1>
      {loans.length === 0 ? (
        <p className="muted">
          Nothing yet. <Link href="/">Borrow something</Link> or{' '}
          <Link href="/tools/new">list a tool</Link>.
        </p>
      ) : null}

      {active.length > 0 ? <h2>Out now</h2> : null}
      <div className="stack">
        {active.map((loan) => {
          const role = getAddress(loan.ownerAddress) === me ? 'owner' : 'borrower'
          const overdue = loan.lateDaysNow > 0
          return (
            <div key={loan.loanId} className="card">
              <div className="row">
                <strong>
                  {loan.tool ? (
                    <Link href={`/tools/${loan.tool.uuid}`}>{loan.tool.title}</Link>
                  ) : (
                    `Loan #${loan.loanId}`
                  )}
                </strong>
                <span className="pill">{role === 'owner' ? 'you lent it' : 'you borrowed it'}</span>
                {overdue ? (
                  <span className="pill" style={{ color: 'var(--warn)' }}>
                    {loan.lateDaysNow} late day{loan.lateDaysNow === 1 ? '' : 's'} billed
                  </span>
                ) : null}
              </div>
              <p className="muted">
                {role === 'owner' ? 'Borrower: ' : 'Owner: '}
                <TrackRecordBadge record={role === 'owner' ? loan.borrower : loan.owner} />
              </p>
              <div className="terms">
                <span>
                  Deposit <strong>{usdcLabel(loan.deposit)}</strong>
                </span>
                <span>
                  Late fee <strong>{usdcLabel(loan.lateFeePerDay)} / day</strong>
                </span>
                <span>
                  Due <strong>{dateTime(loan.dueAt)}</strong> ({relativeTime(loan.dueAt)})
                </span>
              </div>
              <LoanActions
                loanId={loan.loanId}
                role={role}
                dueAt={loan.dueAt}
                maxLateFeeAt={loan.maxLateFeeAt}
                lateDaysNow={loan.lateDaysNow}
                lateFeePerDay={loan.lateFeePerDay.toString()}
                deposit={loan.deposit.toString()}
                receipt={loan.receipt}
              />
            </div>
          )
        })}
      </div>

      {settled.length > 0 ? <h2>Finished</h2> : null}
      {settled.length > 0 ? (
        <table>
          <thead>
            <tr>
              <th>Tool</th>
              <th>Role</th>
              <th>Returned</th>
              <th>Late</th>
              <th>Late fee</th>
              <th>Refund</th>
              <th>How</th>
            </tr>
          </thead>
          <tbody>
            {settled.map((loan) => (
              <tr key={loan.loanId}>
                <td>
                  {loan.tool ? (
                    <Link href={`/tools/${loan.tool.uuid}`}>{loan.tool.title}</Link>
                  ) : (
                    `#${loan.loanId}`
                  )}
                </td>
                <td>{getAddress(loan.ownerAddress) === me ? 'lender' : 'borrower'}</td>
                <td>{loan.returnedAt ? dateTime(loan.returnedAt) : '—'}</td>
                <td>{loan.lateDays ?? 0} d</td>
                <td>{usdcLabel(loan.lateFee ?? 0n)}</td>
                <td>{usdcLabel(loan.refund ?? 0n)}</td>
                <td className="muted">{routeLabels[loan.route ?? ''] ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </>
  )
}
