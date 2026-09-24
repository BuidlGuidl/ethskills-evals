import Link from 'next/link'
import { currentMember } from '@/server/session'
import { requestsByBorrower, requestsForOwner } from '@/server/requests'
import { TrackRecordBadge } from '@/components/TrackRecordBadge'
import { OfferButton } from '@/components/OfferButton'
import { PostButton } from '@/components/PostButton'
import { StartLoanButton } from '@/components/StartLoanButton'
import { dateTime, relativeTime, usdcLabel } from '@/ui/format'

export const dynamic = 'force-dynamic'

/**
 * Both sides of the request queue.
 *
 * The inbox is sorted by the asker's track record — this is the screen where
 * "the reliable people get lent to first" actually happens, because it is where
 * an owner with three people asking for the same drill decides.
 */
export default async function RequestsPage() {
  const me = await currentMember()
  if (!me) return <p className="card">Sign in to see your requests.</p>

  const inbox = requestsForOwner(me)
  const mine = requestsByBorrower(me)

  return (
    <>
      <h1>Requests</h1>

      <h2>People asking to borrow your tools</h2>
      <p className="muted">Best return record first. Approving is a signature, not a transaction.</p>
      {inbox.length === 0 ? <p className="muted">Nothing waiting on you.</p> : null}
      <div className="stack">
        {inbox.map((request) => (
          <div key={request.id} className="card">
            <div className="row">
              <TrackRecordBadge record={request.borrower} />
              <span className="pill">
                <Link href={`/tools/${request.tool.uuid}`}>{request.tool.title}</Link>
              </span>
            </div>
            <p>
              {request.days} day{request.days === 1 ? '' : 's'} · {usdcLabel(request.tool.deposit)}{' '}
              deposit · asked {relativeTime(request.createdAt)}
              {request.note ? ` — “${request.note}”` : ''}
            </p>
            {request.status === 'offered' ? (
              <p className="muted">
                Terms signed {dateTime(request.offer!.createdAt)} — waiting for them to fund the
                deposit. Expires {relativeTime(request.offer!.offerExpiry)}.
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

      <h2>Your requests</h2>
      {mine.length === 0 ? (
        <p className="muted">
          You have not asked for anything yet. <Link href="/">Have a look in the shed.</Link>
        </p>
      ) : null}
      <div className="stack">
        {mine.map((request) => (
          <div key={request.id} className="card">
            <div className="row">
              <strong>
                <Link href={`/tools/${request.tool.uuid}`}>{request.tool.title}</Link>
              </strong>
              <span className="pill">{request.status}</span>
            </div>
            <p className="muted">
              {request.days} day{request.days === 1 ? '' : 's'} · asked{' '}
              {relativeTime(request.createdAt)}
            </p>
            {request.status === 'offered' && request.offer ? (
              <>
                <p>
                  Approved — due back {dateTime(Number(request.offer.terms.dueAt))} if you take it
                  now.
                </p>
                <StartLoanButton offer={request.offer.terms} signature={request.offer.signature} />
                <PostButton url={`/api/requests/${request.id}/withdraw`} label="Withdraw" />
              </>
            ) : request.status === 'pending' ? (
              <PostButton url={`/api/requests/${request.id}/withdraw`} label="Withdraw" />
            ) : request.status === 'started' ? (
              <p className="muted">
                <Link href="/loans">Loan #{request.loanId} is on your loans page.</Link>
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </>
  )
}
