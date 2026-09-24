import type { ReactNode } from 'react'
import type { Member } from '../lib/data'
import { formatScore, formatUsdc, photoSrc } from '../lib/format'

export function Money({ amount, suffix }: { amount: bigint; suffix?: string }) {
  return (
    <span className="money">
      ${formatUsdc(amount)}
      {suffix ? <span className="muted"> {suffix}</span> : null}
    </span>
  )
}

/** The track record, condensed: on-time rate plus the counts it was computed from. */
export function TrackRecord({ member, compact }: { member?: Member; compact?: boolean }) {
  const bps = member?.reliabilityBps ?? 7500
  const tone = member && member.loansBorrowed === 0 ? 'new' : bps >= 9000 ? 'good' : bps >= 7000 ? 'ok' : 'poor'
  return (
    <span className={`track track-${tone}`} title="Share of borrowed tools returned on time">
      {member && member.loansBorrowed === 0 ? 'no loans yet' : `${formatScore(bps)} on time`}
      {!compact && member ? (
        <span className="muted">
          {' '}
          · {member.loansBorrowed} borrowed · {member.lateReturns} late
          {member.defaults > 0 ? ` · ${member.defaults} never returned` : ''}
        </span>
      ) : null}
    </span>
  )
}

export function Photo({ uri, alt }: { uri: string; alt: string }) {
  const src = photoSrc(uri)
  if (!src) return <div className="photo photo-empty">no photo</div>
  return <img className="photo" src={src} alt={alt} loading="lazy" />
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="empty">{children}</p>
}

export function ErrorNote({ error, onDismiss }: { error: string | null; onDismiss?: () => void }) {
  if (!error) return null
  return (
    <p className="error" onClick={onDismiss}>
      {error}
    </p>
  )
}

export function Badge({ children, tone = 'default' }: { children: ReactNode; tone?: string }) {
  return <span className={`badge badge-${tone}`}>{children}</span>
}
