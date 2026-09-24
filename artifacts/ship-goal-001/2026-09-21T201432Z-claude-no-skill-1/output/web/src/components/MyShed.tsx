import { useMemo, useState } from 'react'
import { useAccount } from 'wagmi'
import { toolshedAbi } from '../abis/toolshed'
import { addresses } from '../lib/config'
import {
  compareByTrackRecord,
  displayName,
  LoanStatus,
  type Loan,
  type Neighbourhood,
  type Tool,
} from '../lib/data'
import { dueLabel, formatDate, formatUsdc, parseUsdc } from '../lib/format'
import { useTx } from '../lib/tx'
import { Badge, Empty, ErrorNote, Money, Photo, TrackRecord } from './ui'

const DEFAULT_WINDOW_DAYS = 14

/** Late fee a loan would pay if it settled right now - mirrors Toolshed.accruedLateFee. */
export function accruedLateFee(loan: Loan): bigint {
  const at = loan.returnReportedAt === 0n ? BigInt(Math.floor(Date.now() / 1000)) : loan.returnReportedAt
  if (at <= loan.dueAt) return 0n
  const days = (at - loan.dueAt + 86399n) / 86400n
  const fee = days * loan.dailyLateFee
  return fee > loan.deposit ? loan.deposit : fee
}

export function MyShed({ hood }: { hood: Neighbourhood }) {
  const { address } = useAccount()
  const me = address?.toLowerCase()
  const { send, pending, error, clearError } = useTx(hood.refetch)

  const myTools = useMemo(
    () => hood.tools.filter((t) => t.owner.toLowerCase() === me),
    [hood.tools, me],
  )
  const myToolIds = useMemo(() => new Set(myTools.map((t) => t.id.toString())), [myTools])

  const requests = useMemo(
    () =>
      hood.loans
        .filter((l) => l.status === LoanStatus.Pending && myToolIds.has(l.toolId.toString()))
        .sort((a, b) =>
          compareByTrackRecord(
            hood.memberByAddress.get(a.borrower.toLowerCase()),
            hood.memberByAddress.get(b.borrower.toLowerCase()),
          ),
        ),
    [hood.loans, hood.memberByAddress, myToolIds],
  )

  const out = useMemo(
    () => hood.loans.filter((l) => l.status === LoanStatus.Active && myToolIds.has(l.toolId.toString())),
    [hood.loans, myToolIds],
  )

  if (!address) return <Empty>Connect your wallet to manage your shed.</Empty>

  const toolName = (id: bigint) => hood.tools.find((t) => t.id === id)?.name ?? `Tool #${id}`

  return (
    <section className="stack">
      <ErrorNote error={error} onDismiss={clearError} />

      <div>
        <h2>Requests waiting on you</h2>
        <p className="muted small">Sorted by the borrower's track record - the most reliable neighbour first.</p>
        {requests.length === 0 ? (
          <Empty>No one is waiting.</Empty>
        ) : (
          <ul className="list">
            {requests.map((loan) => {
              const borrower = hood.memberByAddress.get(loan.borrower.toLowerCase())
              return (
                <li key={loan.id.toString()} className="row-item">
                  <div>
                    <strong>{displayName(borrower, loan.borrower)}</strong> wants{' '}
                    <strong>{toolName(loan.toolId)}</strong> for {loan.requestedDays} days
                    <div className="muted small">
                      <TrackRecord member={borrower} /> · deposit held: ${formatUsdc(loan.deposit)}
                    </div>
                  </div>
                  <div className="row">
                    <button
                      className="primary"
                      disabled={!!pending}
                      onClick={() =>
                        send('Approving', {
                          address: addresses.toolshed,
                          abi: toolshedAbi,
                          functionName: 'approveRequest',
                          args: [loan.id],
                        })
                      }
                    >
                      Hand it over
                    </button>
                    <button
                      disabled={!!pending}
                      onClick={() =>
                        send('Declining', {
                          address: addresses.toolshed,
                          abi: toolshedAbi,
                          functionName: 'declineRequest',
                          args: [loan.id],
                        })
                      }
                    >
                      Decline
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div>
        <h2>Tools you have lent out</h2>
        {out.length === 0 ? (
          <Empty>Everything is on the shelf.</Empty>
        ) : (
          <ul className="list">
            {out.map((loan) => {
              const borrower = hood.memberByAddress.get(loan.borrower.toLowerCase())
              const due = dueLabel(loan.dueAt)
              const fee = accruedLateFee(loan)
              const canDefault =
                loan.returnReportedAt === 0n &&
                Date.now() / 1000 > Number(loan.dueAt) + DEFAULT_WINDOW_DAYS * 86400
              return (
                <li key={loan.id.toString()} className="row-item">
                  <div>
                    <strong>{toolName(loan.toolId)}</strong> with {displayName(borrower, loan.borrower)}
                    <div className={due.late ? 'small late' : 'small muted'}>
                      due {formatDate(loan.dueAt)} · {due.text}
                      {fee > 0n ? ` · $${formatUsdc(fee)} late fee accrued to you` : ''}
                      {loan.returnReportedAt !== 0n
                        ? ` · borrower reported it back on ${formatDate(loan.returnReportedAt)}`
                        : ''}
                    </div>
                  </div>
                  <div className="row">
                    <button
                      className="primary"
                      disabled={!!pending}
                      onClick={() =>
                        send('Confirming', {
                          address: addresses.toolshed,
                          abi: toolshedAbi,
                          functionName: 'confirmReturn',
                          args: [loan.id],
                        })
                      }
                    >
                      Confirm return
                    </button>
                    {canDefault ? (
                      <button
                        disabled={!!pending}
                        title="More than 14 days past due with no return reported: keep the whole deposit."
                        onClick={() =>
                          send('Claiming', {
                            address: addresses.toolshed,
                            abi: toolshedAbi,
                            functionName: 'claimDefault',
                            args: [loan.id],
                          })
                        }
                      >
                        Write it off
                      </button>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div>
        <h2>Your tools</h2>
        <ListToolForm onDone={hood.refetch} />
        <div className="grid">
          {myTools.map((tool) => (
            <MyToolCard key={tool.id.toString()} tool={tool} hood={hood} />
          ))}
        </div>
        {myTools.length === 0 ? <Empty>You have not listed anything yet.</Empty> : null}
      </div>
    </section>
  )
}

function MyToolCard({ tool, hood }: { tool: Tool; hood: Neighbourhood }) {
  const { send, pending } = useTx(hood.refetch)
  const history = hood.loansByTool.get(tool.id.toString()) ?? []
  const settled = history.filter((l) => l.status === LoanStatus.Settled || l.status === LoanStatus.Defaulted)
  const earned = settled.reduce((sum, l) => sum + l.lateFeePaid, 0n)

  return (
    <article className="card">
      <Photo uri={tool.photoUri} alt={tool.name} />
      <div className="card-body">
        <header className="card-head">
          <h3>{tool.name}</h3>
          {tool.activeLoanId !== 0n ? (
            <Badge tone="warn">out</Badge>
          ) : tool.listed ? (
            <Badge tone="good">listed</Badge>
          ) : (
            <Badge>unlisted</Badge>
          )}
        </header>
        <p className="notes">{tool.conditionNotes}</p>
        <p className="terms">
          <Money amount={tool.deposit} suffix="deposit" /> ·{' '}
          <Money amount={tool.dailyLateFee} suffix="/ day late" />
        </p>
        <p className="muted small">
          {settled.length} completed loans · ${formatUsdc(earned)} collected in late fees
        </p>
        <button
          disabled={!!pending}
          onClick={() =>
            send('Updating', {
              address: addresses.toolshed,
              abi: toolshedAbi,
              functionName: 'setToolListed',
              args: [tool.id, !tool.listed],
            })
          }
        >
          {tool.listed ? 'Take off the board' : 'Put back on the board'}
        </button>
      </div>
    </article>
  )
}

function ListToolForm({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [photoUri, setPhotoUri] = useState('')
  const [notes, setNotes] = useState('')
  const [deposit, setDeposit] = useState('50')
  const [lateFee, setLateFee] = useState('3')
  const { send, pending, error, clearError } = useTx(() => {
    setOpen(false)
    setName('')
    setPhotoUri('')
    setNotes('')
    onDone()
  })

  if (!open)
    return (
      <button className="primary" onClick={() => setOpen(true)}>
        List a tool
      </button>
    )

  return (
    <div className="panel">
      <label className="field block">
        What is it
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Makita circular saw" />
      </label>
      <label className="field block">
        Photo (https:// or ipfs://CID)
        <input
          value={photoUri}
          onChange={(e) => setPhotoUri(e.target.value)}
          placeholder="ipfs://bafy…"
        />
      </label>
      <label className="field block">
        Condition notes
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Blade is sharp, guard sticks a little."
        />
      </label>
      <div className="row">
        <label className="field">
          Deposit (USDC)
          <input value={deposit} onChange={(e) => setDeposit(e.target.value)} inputMode="decimal" />
        </label>
        <label className="field">
          Late fee per day (USDC)
          <input value={lateFee} onChange={(e) => setLateFee(e.target.value)} inputMode="decimal" />
        </label>
      </div>
      <ErrorNote error={error} onDismiss={clearError} />
      <div className="row">
        <button
          className="primary"
          disabled={!!pending || !name}
          onClick={() =>
            send('Listing', {
              address: addresses.toolshed,
              abi: toolshedAbi,
              functionName: 'listTool',
              args: [name, photoUri, notes, parseUsdc(deposit), parseUsdc(lateFee)],
            })
          }
        >
          {pending ? 'Listing…' : 'List it'}
        </button>
        <button onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </div>
  )
}
