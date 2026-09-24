import type { Reputation } from '../lib/types.js';

const LABELS: Record<Reputation['tier'], string> = {
  trusted: 'Trusted',
  reliable: 'Reliable',
  building: 'Building record',
  watch: 'Often late',
  new: 'New member',
};

/**
 * The track record, in the one place it matters: next to a person's name.
 * Shows the counts as well as the tier, because "3 of 4 on time" is more
 * convincing than a score on its own.
 */
export function TrustBadge({ reputation, detailed }: { reputation?: Reputation; detailed?: boolean }) {
  if (!reputation) return null;
  const { tier, loansBorrowed, lateReturns, score } = reputation;
  const onTime = loansBorrowed - lateReturns;
  return (
    <span className={`badge badge-${tier}`} title={`Track record score ${score}/100`}>
      <span className="badge-dot" aria-hidden="true" />
      {LABELS[tier]}
      {loansBorrowed > 0 && (
        <span className="badge-detail">
          {onTime}/{loansBorrowed} on time
        </span>
      )}
      {detailed && loansBorrowed === 0 && <span className="badge-detail">no loans yet</span>}
    </span>
  );
}
