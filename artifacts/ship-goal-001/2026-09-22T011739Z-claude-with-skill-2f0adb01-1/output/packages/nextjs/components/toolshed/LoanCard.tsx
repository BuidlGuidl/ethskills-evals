"use client";

import { Address } from "@scaffold-ui/components";
import { ToolPhoto } from "~~/components/toolshed/ToolPhoto";
import { TrackRecordBadge } from "~~/components/toolshed/TrackRecordBadge";
import { TxButton } from "~~/components/toolshed/TxButton";
import { useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { useNow } from "~~/hooks/toolshed/useNow";
import { useToolMetadata } from "~~/hooks/toolshed/useToolshed";
import { deadlineIn, formatDate, formatUsdc, relativeDays } from "~~/utils/toolshed/format";
import {
  REQUEST_EXPIRY,
  RETURN_CONFIRM_WINDOW,
  canClaimDefault,
  canExpireRequest,
  canFinalizeReturn,
  settlementNow,
} from "~~/utils/toolshed/loans";
import { LOAN_STATUS_LABEL, Loan, LoanStatus, MemberStats, Tool } from "~~/utils/toolshed/types";

type Props = {
  loan: Loan;
  tool?: Tool;
  /** Whose screen this is. Owners approve and confirm; borrowers cancel and declare returns. */
  perspective: "owner" | "borrower";
  counterparty: MemberStats;
};

export const LoanCard = ({ loan, tool, perspective, counterparty }: Props) => {
  const now = useNow();
  const { data: metadata } = useToolMetadata(tool?.metadataURI);
  const { writeContractAsync } = useScaffoldWriteContract({ contractName: "Toolshed" });

  const call = (functionName: Parameters<typeof writeContractAsync>[0]["functionName"]) => async () => {
    await writeContractAsync({ functionName, args: [BigInt(loan.id)] } as never);
  };

  const { lateDays, feeToOwner, refundToBorrower } = settlementNow(loan, now);
  // finalizeReturn needs both the confirm window and the due date to have passed.
  const settleableAt = Math.max(loan.returnedAt + RETURN_CONFIRM_WINDOW, loan.dueAt);
  const isLate = lateDays > 0;
  const counterpartyAddress = perspective === "owner" ? loan.borrower : tool?.owner;

  return (
    <div className="flex flex-col sm:flex-row gap-4 border border-base-300 bg-base-100 p-4 rounded-box">
      <ToolPhoto src={metadata?.photo} alt={metadata?.name ?? "Tool"} className="h-24 w-24 rounded-box shrink-0" />

      <div className="flex-1 flex flex-col gap-2 min-w-0">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="font-semibold">{metadata?.name ?? `Tool #${loan.toolId}`}</div>
            <div className="flex items-center gap-2 text-sm opacity-70">
              <span>{perspective === "owner" ? "to" : "from"}</span>
              <Address address={counterpartyAddress} size="xs" onlyEnsOrAddress />
            </div>
            <div className="mt-1">
              <TrackRecordBadge stats={counterparty} />
            </div>
          </div>
          <div className="text-right">
            <span
              className={`badge ${
                loan.status === LoanStatus.Defaulted
                  ? "badge-error"
                  : isLate && loan.status !== LoanStatus.Completed
                    ? "badge-warning"
                    : "badge-ghost"
              }`}
            >
              {LOAN_STATUS_LABEL[loan.status]}
            </span>
            <div className="text-xs opacity-60 mt-1">{formatUsdc(loan.deposit)} deposit</div>
          </div>
        </div>

        {loan.status === LoanStatus.Requested && (
          <p className="text-sm opacity-70 m-0">
            Asked for {loan.durationDays} day{loan.durationDays === 1 ? "" : "s"}, {relativeDays(loan.requestedAt, now)}
            .
            {perspective === "borrower"
              ? ` If nobody answers, you can take the deposit back ${deadlineIn(loan.requestedAt + REQUEST_EXPIRY, now)}.`
              : ` The deposit is already escrowed. Unanswered requests can be swept ${deadlineIn(loan.requestedAt + REQUEST_EXPIRY, now)}.`}
          </p>
        )}

        {(loan.status === LoanStatus.Active || loan.status === LoanStatus.ReturnDeclared) && (
          <p className="text-sm m-0">
            Due {formatDate(loan.dueAt)} ({relativeDays(loan.dueAt, now)}).{" "}
            {isLate ? (
              <span className="text-warning font-medium">
                {lateDays} day{lateDays === 1 ? "" : "s"} late — {formatUsdc(feeToOwner)} of the deposit goes to the
                owner, {formatUsdc(refundToBorrower)} back to the borrower.
              </span>
            ) : (
              <span className="opacity-70">On time so far — the full deposit comes back.</span>
            )}
          </p>
        )}

        {loan.status === LoanStatus.ReturnDeclared && (
          <p className="text-sm opacity-70 m-0">
            The borrower says it&apos;s back, so the late-fee clock stopped {relativeDays(loan.returnedAt, now)}.
            {perspective === "owner"
              ? ` Confirm it, or dispute it if it isn't. If you don't, anyone can settle it ${deadlineIn(settleableAt, now)}.`
              : ` If the owner doesn't confirm, anyone can settle it ${deadlineIn(settleableAt, now)} — you'll be charged only up to the moment you declared it back.`}
          </p>
        )}

        {loan.disputed && (
          <p className="text-sm text-error m-0">
            The owner disputed this return, which can only happen once. The steward can settle it with an agreed number
            of late days — or the borrower can declare the return again and settle it after the usual window.
          </p>
        )}

        <div className="flex flex-wrap gap-2 mt-1">
          {perspective === "owner" && loan.status === LoanStatus.Requested && (
            <>
              <TxButton onClick={call("approveRequest")}>Hand it over</TxButton>
              <TxButton className="btn btn-sm btn-ghost" onClick={call("declineRequest")}>
                Decline
              </TxButton>
            </>
          )}

          {perspective === "owner" &&
            (loan.status === LoanStatus.Active || loan.status === LoanStatus.ReturnDeclared) && (
              <TxButton onClick={call("confirmReturn")}>
                Confirm return{isLate ? ` (+${formatUsdc(feeToOwner)})` : ""}
              </TxButton>
            )}

          {perspective === "owner" && loan.status === LoanStatus.ReturnDeclared && !loan.disputed && (
            <TxButton className="btn btn-sm btn-outline btn-error" onClick={call("disputeReturn")}>
              It&apos;s not back
            </TxButton>
          )}

          {perspective === "owner" && canClaimDefault(loan, now) && (
            <TxButton className="btn btn-sm btn-error" onClick={call("claimDefault")}>
              Write off — keep {formatUsdc(loan.deposit)}
            </TxButton>
          )}

          {perspective === "borrower" && loan.status === LoanStatus.Requested && (
            <TxButton className="btn btn-sm btn-ghost" onClick={call("cancelRequest")}>
              Cancel request
            </TxButton>
          )}

          {perspective === "borrower" && canExpireRequest(loan, now) && (
            <TxButton onClick={call("expireRequest")}>Take my deposit back</TxButton>
          )}

          {perspective === "borrower" && loan.status === LoanStatus.Active && (
            <TxButton onClick={call("declareReturn")}>I&apos;ve returned it</TxButton>
          )}

          {perspective === "borrower" && canFinalizeReturn(loan, now) && (
            <TxButton onClick={call("finalizeReturn")}>Settle without the owner</TxButton>
          )}
        </div>
      </div>
    </div>
  );
};
