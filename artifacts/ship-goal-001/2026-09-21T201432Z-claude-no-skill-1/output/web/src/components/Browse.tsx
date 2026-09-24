import { useMemo, useState } from 'react'
import { useAccount } from 'wagmi'
import { toolshedAbi } from '../abis/toolshed'
import { addresses } from '../lib/config'
import {
  compareByTrackRecord,
  displayName,
  LoanStatus,
  type Neighbourhood,
  type Tool,
} from '../lib/data'
import { formatUsdc } from '../lib/format'
import { useEnsureAllowance, useTx, humanError } from '../lib/tx'
import { Badge, Empty, ErrorNote, Money, Photo, TrackRecord } from './ui'

type SortKey = 'trackRecord' | 'deposit' | 'newest'

export function Browse({ hood }: { hood: Neighbourhood }) {
  const { address } = useAccount()
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortKey>('trackRecord')
  const [availableOnly, setAvailableOnly] = useState(true)

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase()
    let tools = hood.tools.filter((t) => t.listed)
    if (availableOnly) tools = tools.filter((t) => t.activeLoanId === 0n)
    if (term) {
      tools = tools.filter(
        (t) =>
          t.name.toLowerCase().includes(term) ||
          t.conditionNotes.toLowerCase().includes(term) ||
          (hood.memberByAddress.get(t.owner.toLowerCase())?.displayName ?? '').toLowerCase().includes(term),
      )
    }
    const sorted = [...tools]
    if (sort === 'deposit') sorted.sort((a, b) => Number(a.deposit - b.deposit))
    else if (sort === 'newest') sorted.sort((a, b) => Number(b.listedAt - a.listedAt))
    else
      sorted.sort((a, b) =>
        compareByTrackRecord(
          hood.memberByAddress.get(a.owner.toLowerCase()),
          hood.memberByAddress.get(b.owner.toLowerCase()),
        ),
      )
    return sorted
  }, [availableOnly, hood.memberByAddress, hood.tools, search, sort])

  return (
    <section>
      <div className="toolbar">
        <input
          className="search"
          placeholder="Search tools, notes, neighbours…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <label className="field">
          Sort by
          <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
            <option value="trackRecord">Owner track record</option>
            <option value="deposit">Deposit, lowest first</option>
            <option value="newest">Recently listed</option>
          </select>
        </label>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={availableOnly}
            onChange={(e) => setAvailableOnly(e.target.checked)}
          />
          Available now
        </label>
      </div>

      {hood.isLoading ? <Empty>Loading the shed…</Empty> : null}
      {!hood.isLoading && rows.length === 0 ? <Empty>Nothing listed yet.</Empty> : null}

      <div className="grid">
        {rows.map((tool) => (
          <ToolCard key={tool.id.toString()} tool={tool} hood={hood} viewer={address} />
        ))}
      </div>
    </section>
  )
}

function ToolCard({
  tool,
  hood,
  viewer,
}: {
  tool: Tool
  hood: Neighbourhood
  viewer: `0x${string}` | undefined
}) {
  const owner = hood.memberByAddress.get(tool.owner.toLowerCase())
  const isOwner = viewer?.toLowerCase() === tool.owner.toLowerCase()
  const out = tool.activeLoanId !== 0n
  const [open, setOpen] = useState(false)

  const myOpenRequest = hood.loansByTool
    .get(tool.id.toString())
    ?.find(
      (l) =>
        l.borrower.toLowerCase() === viewer?.toLowerCase() &&
        (l.status === LoanStatus.Pending || l.status === LoanStatus.Active),
    )

  return (
    <article className="card">
      <Photo uri={tool.photoUri} alt={tool.name} />
      <div className="card-body">
        <header className="card-head">
          <h3>{tool.name}</h3>
          {out ? <Badge tone="warn">out on loan</Badge> : <Badge tone="good">available</Badge>}
        </header>
        <p className="owner">
          {displayName(owner, tool.owner)} · <span className="muted">lent {owner?.loansLent ?? 0}</span> ·{' '}
          <TrackRecord member={owner} compact />
        </p>
        <p className="notes">{tool.conditionNotes || <span className="muted">No condition notes.</span>}</p>
        <p className="terms">
          <Money amount={tool.deposit} suffix="deposit" /> ·{' '}
          <Money amount={tool.dailyLateFee} suffix="/ day late" />
        </p>

        {isOwner ? (
          <p className="muted">Your tool.</p>
        ) : myOpenRequest ? (
          <p className="muted">
            You already have {myOpenRequest.status === LoanStatus.Pending ? 'a request in' : 'this one out'}.
          </p>
        ) : out ? (
          <p className="muted">Ask again once it is back.</p>
        ) : open ? (
          <RequestForm tool={tool} onClose={() => setOpen(false)} onDone={hood.refetch} />
        ) : (
          <button className="primary" onClick={() => setOpen(true)} disabled={!viewer}>
            Ask to borrow
          </button>
        )}
      </div>
    </article>
  )
}

function RequestForm({ tool, onClose, onDone }: { tool: Tool; onClose: () => void; onDone: () => void }) {
  const [days, setDays] = useState(3)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ensureAllowance = useEnsureAllowance()
  const { send, pending } = useTx(() => {
    onDone()
    onClose()
  })

  async function submit() {
    setError(null)
    setBusy(true)
    try {
      await ensureAllowance(tool.deposit)
      await send('Requesting', {
        address: addresses.toolshed,
        abi: toolshedAbi,
        functionName: 'requestLoan',
        args: [tool.id, days],
      })
    } catch (e) {
      setError(humanError(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="request">
      <label className="field">
        Borrow for
        <input
          type="number"
          min={1}
          max={90}
          value={days}
          onChange={(e) => setDays(Math.max(1, Math.min(90, Number(e.target.value) || 1)))}
        />
        days
      </label>
      <p className="muted small">
        ${formatUsdc(tool.deposit)} USDC is held now and refunded when {displayName(undefined, tool.owner)}{' '}
        confirms the return. Every started day past the due date costs ${formatUsdc(tool.dailyLateFee)} out of
        the deposit.
      </p>
      <ErrorNote error={error} onDismiss={() => setError(null)} />
      <div className="row">
        <button className="primary" onClick={submit} disabled={busy || !!pending}>
          {busy || pending ? 'Sending…' : 'Put down the deposit'}
        </button>
        <button onClick={onClose} disabled={busy}>
          Cancel
        </button>
      </div>
    </div>
  )
}
