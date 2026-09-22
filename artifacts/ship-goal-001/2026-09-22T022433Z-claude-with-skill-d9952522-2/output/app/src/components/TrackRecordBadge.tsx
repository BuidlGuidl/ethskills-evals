import type { TrackRecord } from '@/server/reputation'
import { summarize } from '@/server/reputation'
import { displayNameFor } from '@/server/members'
import { reliabilityPercent } from '@/ui/format'

/**
 * The track record, shown the same way everywhere: who they are, how many loans
 * they have taken, how many came back late. The numbers are the point — the
 * percentage is just a summary of them.
 */
export function TrackRecordBadge({
  record,
  showName = true,
}: {
  record: TrackRecord
  showName?: boolean
}) {
  const state = record.overdueNow > 0 ? 'warn' : record.borrowed === 0 ? 'new' : ''
  return (
    <span className="badge">
      <span className={`dot ${state}`} />
      {showName ? <strong>{displayNameFor(record.address, record.displayName)}</strong> : null}
      <span>
        {summarize(record)}
        {record.borrowed > 0 ? ` · ${reliabilityPercent(record.reliability)} on time` : ''}
      </span>
    </span>
  )
}
