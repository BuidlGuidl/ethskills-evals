import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getAddress } from 'viem'
import { toolListing } from '@/server/tools'
import { openRequestsForTool } from '@/server/requests'
import { currentMember } from '@/server/session'
import { getLoan } from '@/server/loans'
import { TrackRecordBadge } from '@/components/TrackRecordBadge'
import { BorrowRequestForm } from '@/components/BorrowRequestForm'
import { OfferButton } from '@/components/OfferButton'
import { PostButton } from '@/components/PostButton'
import { StartLoanButton } from '@/components/StartLoanButton'
import { usdcLabel, dateTime, relativeTime } from '@/ui/format'

export const dynamic = 'force-dynamic'

export default async function ToolPage({ params }: { params: Promise<{ uuid: string }> }) {
  const { uuid } = await params
  const tool = toolListing(uuid)
  if (!tool) notFound()

  const me = await currentMember()
  const isOwner = me ? getAddress(tool.ownerAddress) === me : false
  const requests = isOwner ? openRequestsForTool(uuid) : []
  const activeLoan = tool.activeLoanId ? getLoan(tool.activeLoanId) : undefined

  const myRequests = me
    ? openRequestsForTool(uuid).filter((request) => getAddress(request.borrowerAddress) === me)
    : []
  // Non-owners cannot read the whole queue, but they can see their own place in it.
  const myRequest = isOwner ? undefined : myRequests[0]

  return (
    <>
      <p className="muted">
        <Link href="/">← back to the shed</Link>
      </p>
      <h1>{tool.title}</h1>
      <TrackRecordBadge record={tool.owner} />

      <div className="card">
        {tool.photoKey ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/photos/${tool.photoKey}`}
            alt={tool.title}
            style={{ width: '100%', maxWidth: 520, borderRadius: 8 }}
          />
        ) : null}
        {tool.conditionNotes ? <p>{tool.conditionNotes}</p> : <p className="muted">No notes.</p>}
        <div className="terms">
          <span>
            Deposit <strong>{usdcLabel(tool.deposit)}</strong>
          </span>
          <span>
            Late fee <strong>{usdcLabel(tool.lateFeePerDay)} / day</strong>
          </span>
          <span>
            Capped after <strong>{tool.maxLateDays} late days</strong>
          </span>
          <span>
            Lends for up to <strong>{tool.maxLoanDays} days</strong>
          </span>
          <span>
            Completed loans <strong>{tool.completedLoans}</strong>
          </span>
        </div>
      </div>

      {activeLoan ? (
        <p className="card">
          Out with <TrackRecordBadge record={activeLoan.borrower} /> · due{' '}
          {dateTime(activeLoan.dueAt)} ({relativeTime(activeLoan.dueAt)}) ·{' '}
          <Link href="/loans">loan #{activeLoan.loanId}</Link>
        </p>
      ) : null}

      {!me ? (
        <p className="card">Sign in to ask to borrow this.</p>
      ) : isOwner ? (
        <>
          <h2>Requests for this tool</h2>
          <p className="muted">Best return record first.</p>
          {requests.length === 0 ? <p className="muted">Nobody has asked yet.</p> : null}
          <div className="stack">
            {requests.map((request) => (
              <div key={request.id} className="card">
                <TrackRecordBadge record={request.borrower} />
                <p>
                  {request.days} day{request.days === 1 ? '' : 's'}
                  {request.note ? ` — “${request.note}”` : ''}
                </p>
                {request.status === 'offered' ? (
                  <p className="muted">
                    Terms signed {dateTime(request.offer!.createdAt)} — waiting for them to fund the
                    deposit.
                  </p>
                ) : (
                  <div className="row">
                    <OfferButton requestId={request.id} />
                    <PostButton url={`/api/requests/${request.id}/decline`} label="Decline" />
                  </div>
                )}
              </div>
            ))}
          </div>
          <h2>Listing</h2>
          <PostButton
            url={`/api/tools/${tool.uuid}/retire`}
            label={tool.retired ? 'Put it back on the shelf' : 'Retire this listing'}
            body={{ retired: !tool.retired }}
          />
        </>
      ) : myRequest ? (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Your request</h2>
          {myRequest.status === 'offered' && myRequest.offer ? (
            <>
              <p>
                {tool.owner.displayName || 'The owner'} approved {myRequest.days} day
                {myRequest.days === 1 ? '' : 's'}. Due back{' '}
                {dateTime(Number(myRequest.offer.terms.dueAt))}.
              </p>
              <StartLoanButton offer={myRequest.offer.terms} signature={myRequest.offer.signature} />
            </>
          ) : (
            <p className="muted">
              Asked for {myRequest.days} day{myRequest.days === 1 ? '' : 's'} ·{' '}
              {relativeTime(myRequest.createdAt)}. Waiting for the owner.
            </p>
          )}
          <PostButton url={`/api/requests/${myRequest.id}/withdraw`} label="Withdraw" />
        </div>
      ) : (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Ask to borrow</h2>
          {tool.activeLoanId ? (
            <p className="muted">
              It is out right now — ask anyway and the owner will see your request when it comes
              back.
            </p>
          ) : null}
          <BorrowRequestForm toolUuid={tool.uuid} maxLoanDays={tool.maxLoanDays} />
        </div>
      )}
    </>
  )
}
