"use client";

import { useReadContract } from "wagmi";
import { TxButton } from "./TxButton";
import { TrackRecordBadge } from "./TrackRecordBadge";
import { LOAN_STATUS_LABEL, LoanStatus, toolshed } from "@/lib/contracts";
import { daysOverdue, formatDate, formatUsdc, plural, relativeDays } from "@/lib/format";
import { useChainNow, type LoanWithContext } from "@/hooks/useToolshed";

/** Late fee as it stands at `now` (block time), mirroring the contract: ceil(days) × fee, capped. */
export function currentLateFee(item: LoanWithContext, now: number): { days: number; fee: bigint } {
  const { loan } = item;
  const status = loan.status as LoanStatus;
  if (status === LoanStatus.ReturnPending || status === LoanStatus.Settled) {
    const days = daysOverdue(loan.dueAt, Number(loan.returnedAt));
    return { days, fee: cap(BigInt(days) * loan.dailyLateFee, loan.deposit) };
  }
  if (status !== LoanStatus.Active && status !== LoanStatus.Disputed) return { days: 0, fee: 0n };
  const days = daysOverdue(loan.dueAt, now);
  return { days, fee: cap(BigInt(days) * loan.dailyLateFee, loan.deposit) };
}

function cap(value: bigint, max: bigint): bigint {
  return value > max ? max : value;
}

export function LoanRow({ item, role }: { item: LoanWithContext; role: "owner" | "borrower" }) {
  const { loan, id, metadata, borrowerRecord } = item;
  const status = loan.status as LoanStatus;
  const now = useChainNow();
  const { days: lateDays, fee } = currentLateFee(item, now);

  // The three windows the contract enforces; read them rather than duplicating the constants.
  const confirmWindow = useReadContract({ ...toolshed, functionName: "CONFIRM_WINDOW" });
  const requestTtl = useReadContract({ ...toolshed, functionName: "REQUEST_TTL" });
  const maxOverdue = useReadContract({ ...toolshed, functionName: "MAX_OVERDUE" });

  const confirmSeconds = Number((confirmWindow.data as bigint | undefined) ?? 259_200n);
  const ttlSeconds = Number((requestTtl.data as bigint | undefined) ?? 604_800n);
  const overdueSeconds = Number((maxOverdue.data as bigint | undefined) ?? 2_592_000n);

  const canSelfSettle = status === LoanStatus.ReturnPending && now >= Number(loan.returnedAt) + confirmSeconds;
  const requestExpiresAt = Number(loan.requestedAt) + ttlSeconds;
  const requestStale = status === LoanStatus.Requested && now > requestExpiresAt;
  const writeOffAble =
    (status === LoanStatus.Active || status === LoanStatus.Disputed) &&
    (fee >= loan.deposit || now > Number(loan.dueAt) + overdueSeconds);

  return (
    <li className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-start">
      <div className="flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-semibold">{metadata?.name ?? `Tool #${loan.toolId}`}</h3>
          <span className="rounded-full bg-shed-100 px-2 py-0.5 text-xs text-shed-600">
            {LOAN_STATUS_LABEL[status]}
          </span>
          <span className="text-xs text-shed-600">loan #{id.toString()}</span>
        </div>

        <p className="mt-1 text-sm text-shed-600">
          {status === LoanStatus.Requested && (
            <>
              Asked for {loan.loanDays} {plural(loan.loanDays, "day")} · {formatUsdc(loan.deposit)} deposit held ·{" "}
              {requestStale ? (
                <span className="text-amber-800">too old to approve now</span>
              ) : (
                <>expires {relativeDays(requestExpiresAt, now)}</>
              )}
            </>
          )}
          {status === LoanStatus.Active && (
            <>
              Due {formatDate(loan.dueAt)} ({relativeDays(loan.dueAt, now)})
              {lateDays > 0 && (
                <span className="font-medium text-red-700">
                  {" "}
                  · {lateDays} {plural(lateDays, "day")} late, {formatUsdc(fee)} of the deposit owed to the owner
                </span>
              )}
            </>
          )}
          {status === LoanStatus.ReturnPending && (
            <>
              Returned {formatDate(loan.returnedAt)} · waiting on the owner
              {fee > 0n && <> · {formatUsdc(fee)} late fee</>}
            </>
          )}
          {status === LoanStatus.Disputed && (
            <span className="text-red-700">
              The owner says it is not back. Late fees are still running from {formatDate(loan.dueAt)} —{" "}
              {formatUsdc(fee)} of {formatUsdc(loan.deposit)} so far. Sort it out between you, or ask the steward.
            </span>
          )}
          {status === LoanStatus.Settled && (
            <>
              Closed {formatDate(loan.settledAt)} · {formatUsdc(loan.lateFeePaid)} to the owner,{" "}
              {formatUsdc(loan.deposit - loan.lateFeePaid)} back to the borrower
              {loan.lateDays > 0 && (
                <>
                  {" "}
                  · {loan.lateDays} {plural(loan.lateDays, "day")} late
                </>
              )}
            </>
          )}
          {(status === LoanStatus.Withdrawn ||
            status === LoanStatus.Declined ||
            status === LoanStatus.Expired) && <>Deposit returned in full on {formatDate(loan.settledAt)}</>}
        </p>

        {role === "owner" && (
          <div className="mt-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-shed-600">Borrower</p>
            <TrackRecordBadge record={borrowerRecord} address={loan.borrower} />
          </div>
        )}
      </div>

      <div className="flex w-full flex-col gap-2 sm:w-52">
        {role === "owner" && status === LoanStatus.Requested && (
          <>
            {!requestStale && (
              <TxButton functionName="approveRequest" args={[id]} pendingLabel="Approving…">
                Approve and hand over
              </TxButton>
            )}
            <TxButton
              functionName={requestStale ? "expireRequest" : "declineRequest"}
              args={[id]}
              className="btn-secondary"
              pendingLabel="Returning deposit…"
            >
              {requestStale ? "Return the deposit" : "Decline"}
            </TxButton>
          </>
        )}

        {role === "owner" && (status === LoanStatus.Active || status === LoanStatus.Disputed) && (
          <>
            <TxButton functionName="confirmReturn" args={[id]} pendingLabel="Closing…">
              {fee > 0n ? `Confirm return · keep ${formatUsdc(fee)}` : "Confirm return"}
            </TxButton>
            {writeOffAble && (
              <TxButton
                functionName="claimUnreturned"
                args={[id]}
                className="btn-secondary"
                pendingLabel="Claiming…"
              >
                Never came back · claim {formatUsdc(loan.deposit)}
              </TxButton>
            )}
          </>
        )}

        {role === "owner" && status === LoanStatus.ReturnPending && (
          <>
            <TxButton functionName="confirmReturn" args={[id]} pendingLabel="Closing…">
              {fee > 0n ? `Confirm return · keep ${formatUsdc(fee)}` : "Confirm return"}
            </TxButton>
            <TxButton
              functionName="disputeReturn"
              args={[id]}
              className="btn-secondary"
              pendingLabel="Disputing…"
            >
              It&apos;s not back
            </TxButton>
            <p className="text-xs text-shed-600">
              If you do nothing, the borrower can close this {relativeDays(Number(loan.returnedAt) + confirmSeconds, now)}.
            </p>
          </>
        )}

        {role === "borrower" && status === LoanStatus.Requested && (
          <TxButton
            functionName={requestStale ? "expireRequest" : "withdrawRequest"}
            args={[id]}
            className="btn-secondary"
            pendingLabel="Withdrawing…"
          >
            {requestStale ? "Reclaim" : "Withdraw"} · get {formatUsdc(loan.deposit)} back
          </TxButton>
        )}

        {role === "borrower" && status === LoanStatus.Active && (
          <>
            <TxButton functionName="reportReturn" args={[id]} pendingLabel="Reporting…">
              I&apos;ve returned it
            </TxButton>
            <p className="text-xs text-shed-600">
              Tap this when you hand it back — it stops the late-fee clock even if the owner is slow to confirm.
            </p>
          </>
        )}

        {role === "borrower" && status === LoanStatus.ReturnPending && (
          <>
            <TxButton functionName="settleUnconfirmed" args={[id]} disabled={!canSelfSettle} pendingLabel="Closing…">
              Close it myself
            </TxButton>
            {!canSelfSettle && (
              <p className="text-xs text-shed-600">
                Available {relativeDays(Number(loan.returnedAt) + confirmSeconds, now)} if the owner has not confirmed.
              </p>
            )}
          </>
        )}
      </div>
    </li>
  );
}
