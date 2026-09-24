"use client";

import Link from "next/link";
import { Address as AddressDisplay } from "@scaffold-ui/components";
import type { Address } from "viem";
import { RainbowKitCustomConnectButton } from "~~/components/scaffold-eth";
import {
  EMPTY_RECORD,
  LOAN_STATE_LABEL,
  LoanState,
  OUTCOME_LABEL,
  Outcome,
  type Record,
  TIER_BADGE,
  TIER_LABEL,
  formatUsdc,
  onTimeCount,
  reliabilityScore,
  reliabilityTier,
  resolveUri,
  shortHash,
} from "~~/utils/toolshed";

export const Usd = ({ amount, className = "" }: { amount: bigint | undefined; className?: string }) => (
  <span className={`tabular-nums ${className}`}>{formatUsdc(amount)}</span>
);

/**
 * The track record, rendered the same way everywhere: a tier word, the score, and the raw counts
 * behind it. Members should be able to see why someone ranks where they do.
 */
export const ReliabilityBadge = ({
  record = EMPTY_RECORD,
  showCounts = true,
}: {
  record?: Record;
  showCounts?: boolean;
}) => {
  const tier = reliabilityTier(record);
  return (
    <span className="inline-flex items-center gap-2">
      <span className={`badge badge-sm ${TIER_BADGE[tier]}`}>
        {TIER_LABEL[tier]}
        {record.loansBorrowed > 0 && ` · ${reliabilityScore(record)}`}
      </span>
      {showCounts && (
        <span className="text-xs opacity-70 tabular-nums">
          {record.loansBorrowed === 0
            ? record.loansLent > 0
              ? `lent ${record.loansLent} time${record.loansLent === 1 ? "" : "s"}, never borrowed`
              : "no loans yet"
            : `${onTimeCount(record)}/${record.loansBorrowed} on time` +
              (record.defaults > 0 ? ` · ${record.defaults} never returned` : "")}
        </span>
      )}
    </span>
  );
};

export const MemberLine = ({ address, record }: { address: Address | undefined; record?: Record }) => (
  <span className="inline-flex flex-wrap items-center gap-2">
    <AddressDisplay address={address} size="sm" />
    <ReliabilityBadge record={record} showCounts={false} />
  </span>
);

/**
 * Same thing without the Address component. Card-sized links wrap their whole body in an <a>, and
 * the Address component contains a block-explorer link — nesting those is invalid HTML and React
 * fails hydration over it.
 */
export const MemberLineStatic = ({ address, record }: { address: Address | undefined; record?: Record }) => (
  <span className="inline-flex flex-wrap items-center gap-2">
    <span className="font-mono text-xs opacity-80">{address ? shortHash(address, 6, 4) : "—"}</span>
    <ReliabilityBadge record={record} showCounts={false} />
  </span>
);

export const LoanStateBadge = ({ state, outcome }: { state: number; outcome: number }) => {
  const closed = state === LoanState.Closed;
  const label = closed ? OUTCOME_LABEL[outcome as Outcome] : LOAN_STATE_LABEL[state as LoanState];
  const tone = closed
    ? outcome === Outcome.OnTime
      ? "badge-success"
      : outcome === Outcome.Late
        ? "badge-warning"
        : outcome === Outcome.Defaulted
          ? "badge-error"
          : "badge-ghost"
    : state === LoanState.Disputed
      ? "badge-error"
      : state === LoanState.Active
        ? "badge-info"
        : "badge-ghost";
  return <span className={`badge badge-sm ${tone}`}>{label}</span>;
};

export const ToolPhoto = ({
  image,
  name,
  className = "h-44",
}: {
  image?: string;
  name: string;
  className?: string;
}) => {
  const src = resolveUri(image);
  return (
    <div className={`${className} w-full overflow-hidden bg-base-300 flex items-center justify-center`}>
      {src ? (
        // Photos come from arbitrary IPFS gateways, so next/image's optimizer is out of the picture.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={name} className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <span className="text-4xl opacity-30">🔧</span>
      )}
    </div>
  );
};

export const EmptyState = ({ title, hint, action }: { title: string; hint?: string; action?: React.ReactNode }) => (
  <div className="border border-dashed border-base-300 bg-base-100 p-10 text-center">
    <p className="font-medium">{title}</p>
    {hint && <p className="text-sm opacity-70">{hint}</p>}
    {action && <div className="mt-4 flex justify-center">{action}</div>}
  </div>
);

/**
 * What a disconnected visitor sees. It has to carry a real connect button: telling someone to
 * "connect your wallet" next to nothing clickable, with the only affordance a small control in the
 * header, is the most common way an onchain app loses a first-time user.
 */
export const ConnectPrompt = ({ title, hint }: { title: string; hint?: string }) => (
  <EmptyState title={title} hint={hint} action={<RainbowKitCustomConnectButton />} />
);

/** A skeleton the same shape as the content it stands in for, so nothing jumps on load. */
export const LoadingBlock = ({ className = "h-64" }: { className?: string }) => (
  <div className={`${className} w-full animate-pulse bg-base-300`} />
);

export const SectionHeading = ({
  title,
  hint,
  href,
  hrefLabel,
}: {
  title: string;
  hint?: string;
  href?: string;
  hrefLabel?: string;
}) => (
  <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-base-300 pb-2">
    <div>
      <h2 className="text-xl font-bold m-0">{title}</h2>
      {hint && <p className="m-0 text-sm opacity-70">{hint}</p>}
    </div>
    {href && (
      <Link href={href} className="link text-sm">
        {hrefLabel}
      </Link>
    )}
  </div>
);
