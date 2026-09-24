import { useMemo } from 'react'
import { useAccount } from 'wagmi'
import { toolshedAbi } from '../abis/toolshed'
import { addresses } from '../lib/config'
import { displayName, LoanStatus, loanStatusLabel, type Neighbourhood } from '../lib/data'
import { dueLabel, formatDate, formatUsdc } from '../lib/format'
import { useTx } from '../lib/tx'
import { Badge, Empty, ErrorNote, TrackRecord } from './ui'
import { accruedLateFee } from './MyShed'

const CONFIRMATION_WINDOW_DAYS = 3

export function MyLoans({ hood }: { hood: Neighbourhood }) {
  const { address } = useAccount()
  const me = address?.toLowerCase()
  const { send, pending, error, clearError } = useTx(hood.refetch)

  const mine = useMemo(
    () => hood.loans.filter((l) => l.borrower.toLowerCase() === me).reverse(),
    [hood.loans, me],
  )
  const open = mine.filter((l) => l.status === LoanStatus.Pending || l.status === LoanStatus.Active)
  const past = mine.filter((l) => l.status !== LoanStatus.Pending && l.status !== LoanStatus.Active)

  if (!address) return <Empty>Connect your wallet to see your loans.</Empty>

  const toolName = (id: bigint) => hood.tools.find((t) => t.id === id)?.name ?? `Tool #${id}`

  return (
    <section className="stack">
      <ErrorNote error={error} onDismiss={clearError} />
      <div>
        <h2>Open</h2>
        {open.length === 0 ? (
          <Empty>Nothing out at the moment.</Empty>
        ) : (
          <ul className="list">
            {open.map((loan) => {
              const owner = hood.memberByAddress.get(loan.toolOwner.toLowerCase())
              const due = dueLabel(loan.dueAt)
              const fee = accruedLateFee(loan)
              const canFinalize =
                loan.returnReportedAt !== 0n &&
                Date.now() / 1000 > Number(loan.returnReportedAt) + CONFIRMATION_WINDOW_DAYS * 86400
              return (
                <li key={loan.id.toString()} className="row-item">
                  <div>
                    <strong>{toolName(loan.toolId)}</strong> from {displayName(owner, loan.toolOwner)}
                    <div className="small muted">
                      {loan.status === LoanStatus.Pending ? (
                        <>waiting for the owner to hand it over · ${formatUsdc(loan.deposit)} held</>
                      ) : (
                        <>
                          <span className={due.late ? 'late' : undefined}>
                            due {formatDate(loan.dueAt)} · {due.text}
                          </span>
                          {' · '}${formatUsdc(loan.deposit - fee)} of ${formatUsdc(loan.deposit)} coming back
                          {loan.returnReportedAt !== 0n ? ' · return reported' : ''}
                        </>
                      )}
                    </div>
                  </div>
                  <div className="row">
                    {loan.status === LoanStatus.Pending ? (
                      <button
                        disabled={!!pending}
                        onClick={() =>
                          send('Cancelling', {
                            address: addresses.toolshed,
                            abi: toolshedAbi,
                            functionName: 'cancelRequest',
                            args: [loan.id],
                          })
                        }
                      >
                        Withdraw request
                      </button>
                    ) : loan.returnReportedAt === 0n ? (
                      <button
                        className="primary"
                        disabled={!!pending}
                        title="Stops the late-fee clock at this moment, even if the owner confirms later."
                        onClick={() =>
                          send('Reporting', {
                            address: addresses.toolshed,
                            abi: toolshedAbi,
                            functionName: 'reportReturn',
                            args: [loan.id],
                          })
                        }
                      >
                        I gave it back
                      </button>
                    ) : (
                      <button
                        className="primary"
                        disabled={!!pending || !canFinalize}
                        title={
                          canFinalize
                            ? 'The owner never confirmed - close it out yourself.'
                            : 'Available 3 days after you report the return if the owner has not confirmed.'
                        }
                        onClick={() =>
                          send('Closing', {
                            address: addresses.toolshed,
                            abi: toolshedAbi,
                            functionName: 'finalizeReportedReturn',
                            args: [loan.id],
                          })
                        }
                      >
                        Close it out
                      </button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div>
        <h2>Your record</h2>
        <p className="muted">
          <TrackRecord member={hood.memberByAddress.get(me ?? '')} />
        </p>
        {past.length === 0 ? (
          <Empty>No completed loans yet.</Empty>
        ) : (
          <ul className="list">
            {past.map((loan) => (
              <li key={loan.id.toString()} className="row-item">
                <div>
                  <strong>{toolName(loan.toolId)}</strong>
                  <div className="small muted">
                    {formatDate(loan.settledAt)} ·{' '}
                    {loan.lateDays > 0
                      ? `${loan.lateDays} days late · $${formatUsdc(loan.lateFeePaid)} late fee paid`
                      : 'on time · deposit returned in full'}
                  </div>
                </div>
                <Badge
                  tone={
                    loan.status === LoanStatus.Defaulted
                      ? 'bad'
                      : loan.lateDays > 0
                        ? 'warn'
                        : loan.status === LoanStatus.Settled
                          ? 'good'
                          : 'default'
                  }
                >
                  {loanStatusLabel[loan.status]}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
